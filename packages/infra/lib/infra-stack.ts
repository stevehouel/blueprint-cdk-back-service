
import { CfnOutput, Fn, Stack, StackProps, Token } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CfnUserPoolGroup,
  Mfa,
  OAuthScope,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Effect, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { MxRecord, PublicHostedZone, TxtRecord } from 'aws-cdk-lib/aws-route53';
import { IdentityPool, UserPoolAuthenticationProvider } from '@aws-cdk/aws-cognito-identitypool-alpha';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { CfnAppMonitor } from 'aws-cdk-lib/aws-rum';
import { DnsValidatedDomainIdentity } from 'aws-cdk-ses-domain-identity';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { DeadLetterQueue } from 'project-constructs';

interface InfraStackProps extends StackProps {
  readonly domainName?: string;
  readonly cognitoDomainPrefix: string;
  readonly callbackUrls?: string[];
  readonly logoutUrls?: string[];
  readonly terminationProtection?: boolean;
  readonly testingRoleArn: string;
}

export class InfraStack extends Stack {
  public cognitoUserPool: UserPool;
  public cognitoUserPoolClient: UserPoolClient;
  public identityPool: IdentityPool;
  public notificationQueue: Queue;

  public hostedZoneId: CfnOutput;
  public hostedZoneNS: CfnOutput;
  public userPoolId: CfnOutput;
  public identityPoolId: CfnOutput;
  public userPoolDomain: CfnOutput;
  public userPoolAppClientId: CfnOutput;
  public authRoleArn: CfnOutput;
  public unauthRoleArn: CfnOutput;
  public userPoolProviderUrl: CfnOutput;
  public testUserSecretArn: CfnOutput;
  public testAdminSecretArn: CfnOutput;
  public rumApplicationId: CfnOutput;
  public notificationQueueArn: CfnOutput;

  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);
    const testingRole = Role.fromRoleArn(this, 'TestingRole_Infra', props.testingRoleArn);

    let hostedZone: PublicHostedZone | undefined;

    // ** DEAD LETTER QUEUES **
    const notificationDLQ = new DeadLetterQueue(this, 'notificationDLQ', {
      fifo: true
    });

    // ** SQS QUEUES **
    this.notificationQueue = new Queue(this, 'notificationQueue', {
      encryption: QueueEncryption.KMS_MANAGED,
      contentBasedDeduplication: true,
      fifo: true,
      deadLetterQueue: {
        queue: notificationDLQ,
        maxReceiveCount: 5, // retry sending notification 5 times before moving message to DLQ
      },
    });

    this.cognitoUserPool = new UserPool(this, 'UserPool', {
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      mfa: Mfa.OFF,
    });

    // Create UserPool domain
    const domain = this.cognitoUserPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: props.cognitoDomainPrefix,
      },
    });

    // Create Groups
    new CfnUserPoolGroup(this, 'UserPoolAdminGroup', {
      userPoolId: this.cognitoUserPool.userPoolId,
      groupName: 'Admin',
      description: 'Admin Group',
    });

    // Create App Client
    const callbackUrls = (props.callbackUrls ? props.callbackUrls : []).concat(
      (props.domainName ? [ `https://${props.domainName}` ] : []));

    this.cognitoUserPoolClient = this.cognitoUserPool.addClient('UserPoolAppClient', {
      preventUserExistenceErrors: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [ OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PHONE, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN ],
        callbackUrls,
      }
    });

    const identityPool = new IdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: true,
    });

    identityPool.addUserPoolAuthentication(new UserPoolAuthenticationProvider({
      userPoolClient: this.cognitoUserPoolClient,
      userPool: this.cognitoUserPool
    }));

    identityPool.unauthenticatedRole.addToPrincipalPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [ 'rum:PutRumEvents' ],
      resources: [ this.formatArn({ service: 'rum', resource: 'appmonitor', resourceName: props.domainName }) ],
    }));

    if (props.domainName) {
      hostedZone = new PublicHostedZone(this, 'HostedZone', {
        zoneName: props.domainName,
      });

      this.hostedZoneId = new CfnOutput(this, 'HostedZoneId', {
        value: hostedZone.hostedZoneId,
      });

      this.hostedZoneNS = new CfnOutput(this, 'HostedZoneNameServers', {
        value: Fn.join(',', Token.asList(hostedZone.hostedZoneNameServers)),
      });

      this.configureSes(hostedZone, props.domainName);

      const rumCfnAppMonitor = new CfnAppMonitor(this, 'RumAppMonitor', {
        name: props.domainName,
        cwLogEnabled: true,
        domain: props.domainName,
        appMonitorConfiguration: {
          allowCookies: true,
          enableXRay: true,
          sessionSampleRate: 0.5,
          telemetries: [ 'errors', 'performance', 'http' ],
          identityPoolId: identityPool.identityPoolId,
          guestRoleArn: identityPool.unauthenticatedRole.roleArn,
        },
      });

      this.rumApplicationId = new CfnOutput(this, 'RumAppId', {
        value: rumCfnAppMonitor.ref,
      });

    }

    this.userPoolId = new CfnOutput(this, 'UserPoolId', {
      value: this.cognitoUserPool.userPoolId,
    });

    this.identityPoolId = new CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.identityPoolId,
    });

    this.userPoolAppClientId = new CfnOutput(this, 'UserPoolAppClientId', {
      value: this.cognitoUserPoolClient.userPoolClientId,
    });

    this.userPoolDomain = new CfnOutput(this, 'UserPoolDomain', {
      value: domain.baseUrl(),
    });

    this.userPoolProviderUrl = new CfnOutput(this, 'UserPoolProviderUrl', {
      value: this.cognitoUserPool.userPoolProviderUrl,
    });

    this.unauthRoleArn = new CfnOutput(this, 'UnauthRoleArn', {
      value: this.identityPool.unauthenticatedRole.roleArn,
    });

    this.authRoleArn = new CfnOutput(this, 'AuthRoleArn', {
      value: this.identityPool.authenticatedRole.roleArn,
    });

    this.notificationQueueArn = new CfnOutput(this, 'NotificationQueueArn', {
      value: this.notificationQueue.queueArn,
    });

    // ** Test user credentials **
    const testUserSecret = new Secret(this, 'TestUserSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'testuser' }),
        generateStringKey: 'password',
      },
      description: 'Secret storing test user credentials',
    });

    this.testUserSecretArn = new CfnOutput(this, 'TestUserSecretArn', {
      value: testUserSecret.secretArn,
    });
    testUserSecret.grantRead(testingRole);

    // ** Test admin credentials **
    const testAdminSecret = new Secret(this, 'TestAdminSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'testadmin' }),
        generateStringKey: 'password',
      },
      description: 'Secret storing test admin credentials',
    });

    this.testAdminSecretArn = new CfnOutput(this, 'TestAdminSecretArn', {
      value: testAdminSecret.secretArn,
    });

    testAdminSecret.grantRead(testingRole);


  }

  configureSes(hostedZone: PublicHostedZone, domainName: string): void {
    new DnsValidatedDomainIdentity(this, 'DomainIdentity', {
      hostedZone,
      domainName,
      dkim: true,
    });

    new TxtRecord(this, 'TxtRecord',{
      zone: hostedZone,
      recordName: `mail.${domainName}`,
      values: [
        'v=spf1 include:amazonses.com ~all',
      ],
    });

    new MxRecord(this,'MxRecord', {
      zone: hostedZone,
      recordName: `mail.${domainName}`,
      values: [
        {
          priority: 10,
          hostName: `feedback-smtp.${this.region}.amazonses.com`,
        },
      ],
    });
  }
}
