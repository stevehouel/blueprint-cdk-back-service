import { InfraStack } from './infra-stack';
import { TestingStack } from './testing-stack';
import { ModelStack } from './model-stack';
import { CfnOutput, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { APIStack } from 'rest-api';

export interface InfraStageProps extends StageProps {
  readonly domainName?: string;
  readonly cognitoDomainPrefix: string;
  readonly callbackUrls?: string[];
  readonly logoutUrls?: string[];
  readonly pipelineAccount: string;
  readonly terminationProtection?: boolean;
}

export class InfraStage extends Stage {
  public readonly userPoolId: CfnOutput;
  public readonly identityPoolId: CfnOutput;
  public readonly userPoolDomain: CfnOutput;
  public readonly userPoolAppClientId: CfnOutput;
  public readonly apiUrl: CfnOutput;
  public readonly testUserSecretArn: CfnOutput;
  public readonly testAdminSecretArn: CfnOutput;
  public readonly testingRoleArn: CfnOutput;

  constructor(scope: Construct, id: string, props: InfraStageProps) {
    super(scope, id, props);

    const testingStack = new TestingStack(this, 'Testing', {
      pipelineAccount: props.pipelineAccount,
      terminationProtection: props.terminationProtection,
    });

    const infraStack = new InfraStack(this, 'Infra', {
      domainName: props.domainName,
      cognitoDomainPrefix: props.cognitoDomainPrefix,
      callbackUrls: props.callbackUrls,
      logoutUrls: props.logoutUrls,
      terminationProtection: props.terminationProtection,
      testingRoleArn: testingStack.testingRoleArn.value,
    });

    const modelStack = new ModelStack(this, 'Model', {
      terminationProtection: props.terminationProtection,
      testingRoleArn: testingStack.testingRoleArn.value,
    });

    const apiStack = new APIStack(this, 'RestApi', {
      terminationProtection: props.terminationProtection,
      authRoleArn: infraStack.authRoleArn.value,
      unauthRoleArn: infraStack.unauthRoleArn.value,
      domainName: props.domainName ? `api.${props.domainName}` : undefined,
      hostedZoneId: infraStack.hostedZoneId ? infraStack.hostedZoneId.value : undefined,
      testingRoleArn: testingStack.testingRoleArn.value,
      demoTableArn: modelStack.demoTableArn.value,
      demoTableStreamArn: modelStack.demoTableStreamArn.value,
      notificationQueueArn: infraStack.notificationQueueArn.value
    });

    // Outputs
    this.userPoolId = infraStack.userPoolId;
    this.identityPoolId = infraStack.identityPoolId;
    this.userPoolAppClientId = infraStack.userPoolAppClientId;
    this.userPoolDomain = infraStack.userPoolDomain;
    this.apiUrl = apiStack.apiUrl;
    this.testUserSecretArn = infraStack.testUserSecretArn;
    this.testAdminSecretArn = infraStack.testAdminSecretArn;
    this.testingRoleArn = testingStack.testingRoleArn;
  }
}
