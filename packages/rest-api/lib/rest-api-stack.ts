import { join as pathJoin } from 'path';

import { DeadLetterQueue, DynamoTable, LambdaFunction, ApiLambdaFunction, HttpApi } from 'project-constructs';
import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { DynamoEventSource, SqsDlq, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { ILambdaDeploymentConfig, LambdaApplication } from 'aws-cdk-lib/aws-codedeploy';
import { HttpUserPoolAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { DomainMappingOptions, DomainName, HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import {FilterPattern, LogGroup, MetricFilter, RetentionDays} from 'aws-cdk-lib/aws-logs';
import { OperationalStack } from './operational-stack';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {CfnStage} from 'aws-cdk-lib/aws-apigatewayv2';

export const HTTP_4XX_ERROR = 'Http4XXError';

export interface APIProps extends StackProps {
  readonly projectName: string;
  readonly authRoleArn: string;
  readonly unauthRoleArn: string;
  readonly domainName?: string;
  readonly hostedZoneId?: string;
  readonly testingRoleArn: string;
  readonly demoTableArn: string;
  readonly demoTableStreamArn: string;
  readonly notificationQueueArn: string;
  readonly userPoolId: string;
  readonly deploymentConfig?: ILambdaDeploymentConfig;
}

/** CDK Stack containing DemoFactory rest api. */
export class APIStack extends Stack {
  /** Queue for feedback messages */
  public readonly feedbackQueue: Queue;
  public readonly application: LambdaApplication;
  public readonly api: HttpApi;
  /** CloudFormation output containing the rest api url */
  public readonly apiId: CfnOutput;
  public readonly apiStage: CfnOutput;
  public readonly apiUrl: CfnOutput;
  public readonly feedbackQueueArn: CfnOutput;

  constructor(scope: Construct, id: string, props: APIProps) {
    super(scope, id, props);
    //const testingRole = Role.fromRoleArn(this, 'TestingRole_RestApi', props.testingRoleArn);
    const userPool = UserPool.fromUserPoolId(this, 'UserPool', props.userPoolId);
    const demoTable = DynamoTable.fromTableAttributes(this, 'Demo', {
      tableArn: props.demoTableArn,
      tableStreamArn: props.demoTableStreamArn,
      globalIndexes: [ 'UserIndex', 'UserValidationStatusIndex', 'IdIndex' ]
    } );

    this.application = new LambdaApplication(this, 'CodeDeployApplication', {});

    const notificationQueue = Queue.fromQueueArn(this, 'notificationQueue', props.notificationQueueArn);

    // ** Api Gateway **
    let domainMapping: DomainMappingOptions | undefined = undefined;
    let apiUrl: string | undefined;

    if (props.domainName && props.hostedZoneId) {
      apiUrl = `https://${props.domainName}/`;
      const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });

      const certificate = new DnsValidatedCertificate(this, 'Certificate', {
        domainName: props.domainName,
        hostedZone,
      });
      const customDomainName = new DomainName(this, 'DomainName', {
        domainName: props.domainName,
        certificate,
      });
      domainMapping = { domainName: customDomainName };

      new CnameRecord(this, 'APIAliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        domainName: customDomainName.regionalDomainName,
        ttl: Duration.minutes(15),
      });
    }

    const authorizer = new HttpUserPoolAuthorizer('Authorizer', userPool );

    this.api = new HttpApi(this, 'HttpApi', {
      defaultDomainMapping: domainMapping,
      disableExecuteApiEndpoint: domainMapping != undefined,
    });

    const apiLogGroup = new LogGroup(this, 'ApiAccessLogGroup', {
      retention: RetentionDays.TEN_YEARS,
    });

    const apiStage: CfnStage | undefined = this.api.defaultStage?.node.defaultChild as CfnStage;
    if (apiStage) {
      apiStage.defaultRouteSettings = {
        ...apiStage.defaultRouteSettings,
        detailedMetricsEnabled: true,
      };
      apiStage.accessLogSettings = {
        destinationArn: apiLogGroup.logGroupArn,
        format: '{ "httpMethod":"$context.httpMethod",' +
          '"routeKey":"$context.routeKey",' +
          '"status":"$context.status",' +
          '"protocol":"$context.protocol", ' +
          '"responseLength":"$context.responseLength", ' +
          '"requestTime":"$context.requestTime", ' +
          '"requestId":"$context.requestId", ' +
          '"errorMessage":"$context.error.message" }',
      };
    }

    new MetricFilter(this, `${HTTP_4XX_ERROR}MetricFilter`, {
      metricNamespace: 'API',
      metricName: HTTP_4XX_ERROR,
      logGroup: apiLogGroup,
      filterPattern: FilterPattern.all(
        FilterPattern.stringValue('$.status', '=', '4*'),
        FilterPattern.stringValue('$.status', '!=', '401'),
        FilterPattern.stringValue('$.status', '!=', '403'),
        FilterPattern.stringValue('$.status', '!=', '404'),
      ),
      metricValue: '1',
    });


    // ** SQS Queues **
    this.feedbackQueue = new Queue(this, 'Feedback', {
      encryption: QueueEncryption.KMS_MANAGED,
    });
    this.feedbackQueueArn = new CfnOutput(this, 'FeedbackQueueArn', {
      value: this.feedbackQueue.queueArn,
    });

    // ** LAMBDAS **
    const postFeedbackLambda = new LambdaFunction(this, 'postFeedbackLambda', {
      entry: pathJoin(__dirname, '../src/handlers/feedback.handler.js'),
      handler: 'post',
      environment: {
        QUEUE_URL: this.feedbackQueue.queueUrl,
      },
      application: this.application,
      deploymentConfig: props.deploymentConfig,
    });
    this.feedbackQueue.grantSendMessages(postFeedbackLambda);

    // Demo
    const getAllDemoFunction = new ApiLambdaFunction(this, 'GetAllDemosFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'getAll',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      api: this.api,
      method: HttpMethod.GET,
      path: '/demos',
      authorizer
    });
    demoTable.grantReadData(getAllDemoFunction);

    const getDemoFunction = new ApiLambdaFunction(this, 'GetDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'get',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      api: this.api,
      method: HttpMethod.GET,
      path: '/demos/{demoId}',
      authorizer
    });
    demoTable.grantReadData(getDemoFunction);

    const postDemoFunction = new ApiLambdaFunction(this, 'PostDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'post',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      api: this.api,
      method: HttpMethod.POST,
      path: '/demos',
      authorizer
    });
    demoTable.grantWriteData(postDemoFunction);

    const putDemoFunction = new ApiLambdaFunction(this, 'PutDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'put',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      api: this.api,
      method: HttpMethod.PUT,
      path: '/demos/{demoId}',
      authorizer
    });
    demoTable.grantReadWriteData(putDemoFunction);

    const deleteDemoFunction = new ApiLambdaFunction(this, 'DeleteDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'deleteDemo',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      api: this.api,
      method: HttpMethod.DELETE,
      path: '/demos/{demoId}',
      authorizer
    });
    demoTable.grantReadWriteData(deleteDemoFunction);

    // ** DEAD LETTER QUEUES **
    const demoConsumerDLQ = new DeadLetterQueue(this, 'DemoConsumerDLQ', {});

    // ** Notifications **
    const notificationLambda = new LambdaFunction(this, 'NotificationLambda', {
      entry: pathJoin(__dirname, '../src/notifications/notifier.js'),
      handler: 'notify',
      timeout: Duration.seconds(4),
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      environment: {
        DOMAIN_NAME: props.domainName || '',
        // Set to true to ignore notifications
        // IGNORE_NOTIFICATIONS: "true",
      }
    });
    notificationLambda.role?.addToPrincipalPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [ 'ses:SendEmail' ],
      resources: [ '*' ],
    }));
    notificationLambda.addEventSource(new SqsEventSource(notificationQueue, {
      batchSize: 1,
    }));
    notificationQueue.grantConsumeMessages(notificationLambda);

    // ** Consumers
    const demoConsumerLambda = new LambdaFunction(this, 'DemoConsumerLambda', {
      entry: pathJoin(__dirname, '../src/consumers/demo.consumer.js'),
      handler: 'consume',
      application: this.application,
      deploymentConfig: props.deploymentConfig,
      environment: {
        DOMAIN_NAME: props.domainName || '',
      }
    });
    demoConsumerLambda.addEventSource(new DynamoEventSource(demoTable, {
      startingPosition: StartingPosition.TRIM_HORIZON,
      batchSize: 1,
      onFailure: new SqsDlq(demoConsumerDLQ),
      retryAttempts: 0,
    }));

    // ** Operational Stack **
    new OperationalStack(this, 'OperationalStack', {
      projectName: props.projectName,
      api: this.api,
      lambdaFunctions: [
        notificationLambda,
        demoConsumerLambda,
        deleteDemoFunction,
        putDemoFunction,
        postDemoFunction,
        getAllDemoFunction,
        getDemoFunction
      ],
    });

    this.apiId = new CfnOutput(this, 'ApiId', {
      value: this.api.apiId,
    });
    this.apiStage = new CfnOutput(this, 'ApiStage', {
      value: this.api.defaultStage?.stageName || '',
    });
    this.apiUrl = new CfnOutput(this, 'ApiUrl', {
      value: apiUrl || this.api.url || '',
    });
  }
}

