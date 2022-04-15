import { join as pathJoin } from 'path';

import { DeadLetterQueue, DynamoTable, LambdaFunction } from 'project-constructs';
import { CfnOutput, Duration, Fn, NestedStack, NestedStackProps, Stack, StackProps } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Effect, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { DynamoEventSource, SqsDlq, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import {
  AssetApiDefinition,
  SpecRestApi
} from 'aws-cdk-lib/aws-apigateway';
import {
  Dashboard,
  GraphWidget,
  GRID_WIDTH,
  HorizontalAnnotation,
  IWidget,
  Metric,
  Statistic,
  TextWidget
} from 'aws-cdk-lib/aws-cloudwatch';
import { RestApiBase } from 'aws-cdk-lib/aws-apigateway/lib/restapi';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { ApiLambdaFunction } from 'project-constructs/lib/ApiLambdaFunction';

export interface APIProps extends StackProps {
  authRoleArn: string;
  unauthRoleArn: string;
  domainName?: string;
  hostedZoneId?: string;

  readonly testingRoleArn: string;
  readonly demoTableArn: string;
  readonly demoTableStreamArn: string;
  readonly notificationQueueArn: string,
}

interface ApiGatewayMetricInfo {
  method: string;
  resource: string;
}


/** CDK Stack containing DemoFactory rest api. */
export class APIStack extends Stack {
  /** Queue for feedback messages */
  public readonly feedbackQueue: Queue;
  /** CloudFormation output containing the rest api url */
  public readonly apiUrl: CfnOutput;
  public readonly feedbackQueueArn: CfnOutput;

  constructor(scope: Construct, id: string, props: APIProps) {
    super(scope, id, props);
    //const testingRole = Role.fromRoleArn(this, 'TestingRole_RestApi', props.testingRoleArn);
    const demoTable = DynamoTable.fromTableAttributes(this, 'Demo', {
      tableArn: props.demoTableArn,
      tableStreamArn: props.demoTableStreamArn,
      globalIndexes: [ 'UserIndex', 'UserValidationStatusIndex', 'IdIndex' ]
    } );

    const notificationQueue = Queue.fromQueueArn(this, 'notificationQueue', props.notificationQueueArn);

    // ** Api Gateway **
    // Create Api Specs asset
    const asset = new Asset(this, 'ApiAsset', {
      path: '../rest-api/specs/api-specs.yaml',
    });

    // Transform Specs file
    const specsContent = Fn.transform('AWS::Include', { Location: asset.s3ObjectUrl });

    const api = new SpecRestApi(this, 'Api', {
      apiDefinition: AssetApiDefinition.fromInline(specsContent),
      deployOptions: {
        dataTraceEnabled: true
      }
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
      }
    });
    this.feedbackQueue.grantSendMessages(postFeedbackLambda);

    // Demo
    const getAllDemoFunction = new ApiLambdaFunction(this, 'getAllDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'getAll',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      api: api,
      method: 'GET',
      path: '/demos'
    });
    demoTable.grantReadData(getAllDemoFunction);

    const getDemoFunction = new ApiLambdaFunction(this, 'getDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'get',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      api: api,
      method: 'GET',
      path: '/demos/{demoId}/'
    });
    demoTable.grantReadData(getDemoFunction);

    const postDemoFunction = new ApiLambdaFunction(this, 'postDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'post',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      api: api,
      method: 'POST',
      path: '/demos'
    });
    demoTable.grantWriteData(postDemoFunction);

    const putDemoFunction = new ApiLambdaFunction(this, 'putDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'put',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      api: api,
      method: 'PUT',
      path: '/demos/{demoId}'
    });
    demoTable.grantReadWriteData(putDemoFunction);

    const deleteDemoFunction = new ApiLambdaFunction(this, 'deleteDemoFunction', {
      entry: pathJoin(__dirname, '../src/handlers/demo.handler.js'),
      handler: 'deleteDemo',
      environment: {
        DEMO_TABLE_NAME: demoTable.tableName,
      },
      api: api,
      method: 'DELETE',
      path: '/demos/{demoId}'
    });
    demoTable.grantReadWriteData(deleteDemoFunction);

    // ** DEAD LETTER QUEUES **
    const demoConsumerDLQ = new DeadLetterQueue(this, 'demoConsumerDLQ', {});

    // ** Notifications **
    const notificationLambda = new LambdaFunction(this, 'notificationLambda', {
      entry: pathJoin(__dirname, '../src/notifications/notifier.js'),
      handler: 'notify',
      timeout: Duration.seconds(4),
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
    const demoConsumerLambda = new LambdaFunction(this, 'demoConsumerLambda', {
      entry: pathJoin(__dirname, '../src/consumers/demo.consumer.js'),
      handler: 'consume',
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

    // ** CW Dashboard **
    new DashboardsStack(this, 'DashboardsStack', {
      api: api,
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
  }
}

export interface DashboardsStackProps extends NestedStackProps {
  api: RestApiBase;
  lambdaFunctions: LambdaFunction [];
}

class DashboardsStack extends NestedStack {
  constructor(scope: Construct, id: string, props: DashboardsStackProps) {
    super(scope, id, props);

    const dashboard = new Dashboard(this, 'BackendDashboard', {
      dashboardName: 'DemoFactory_Backend',
    });

    const lambdaErrorWidgets: IWidget[] = [];
    props.lambdaFunctions.forEach(lambdaFunction => {
      lambdaErrorWidgets.push(lambdaFunction.errorWidget);
    });

    dashboard.addWidgets(
      new TextWidget({
        markdown: '# API Gateway Metrics',
        width: GRID_WIDTH,
        height: 1,
      }),
      new GraphWidget({
        width: 12,
        height: 6,
        title: 'API [Requests]',
        left: [
          new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: Statistic.SUM,
            period: Duration.seconds(300),
            dimensionsMap: { ApiId: props.api.restApiId },
          }),
        ],
      }),
      new GraphWidget({
        width: 12,
        height: 6,
        title: 'API [Errors]',
        left: [
          new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4xx',
            statistic: Statistic.SUM,
            period: Duration.seconds(300),
            dimensionsMap: { ApiId: props.api.restApiId },
          }),
          new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5xx',
            statistic: Statistic.SUM,
            period: Duration.seconds(300),
            dimensionsMap: { ApiId: props.api.restApiId },
          }),
        ],
      }),
      this.apiGatewayLatencyWidget(props.api, 'API [Latency p90]', 'Latency', 'p90',{ value: 1000, label: 'SLA' }),
      this.apiGatewayLatencyWidget(props.api, 'API [4XX Sum]', '4xx', 'Sum', { value: 10, label: 'Threshold' }),
      new TextWidget({
        markdown: '# Lambda Metrics',
        width: GRID_WIDTH,
        height: 1,
      }),
      ...lambdaErrorWidgets,
    );
  }

  apiGatewayLatencyWidget(api: SpecRestApi, title: string, metricName: string, statistic: string, annotation: HorizontalAnnotation): GraphWidget {
    const API_GATEWAY_ROUTES = [
      { method: 'POST', resource: '/feedbacks' } as ApiGatewayMetricInfo,
      { method: 'GET', resource: '/demos' } as ApiGatewayMetricInfo,
      { method: 'POST', resource: '/demos' } as ApiGatewayMetricInfo,
      { method: 'GET', resource: '/demos/{id}' } as ApiGatewayMetricInfo,
      { method: 'PUT', resource: '/demos/{id}' } as ApiGatewayMetricInfo,
      { method: 'DELETE', resource: '/demos/{id}' } as ApiGatewayMetricInfo,
    ];
    const widget = new GraphWidget({
      width: GRID_WIDTH,
      height: 6,
      title,
      left: [],
      leftAnnotations: [ annotation ],
    });
    for (const route of API_GATEWAY_ROUTES) {
      widget.addLeftMetric(new Metric({
        dimensionsMap: { Method: route.method, Resource: route.resource, ApiId: api.restApiId, Stage: api.deploymentStage.stageName },
        namespace: 'AWS/ApiGateway',
        metricName,
        statistic,
        period: Duration.seconds(300),
      }));
    }
    return widget;
  }
}
