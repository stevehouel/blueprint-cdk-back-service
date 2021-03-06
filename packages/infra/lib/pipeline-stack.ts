import { Stack, StackProps } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { InfraStage, InfraStageProps } from './infra-stage';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ComputeType } from 'aws-cdk-lib/aws-codebuild';

export interface StageEnvironment extends InfraStageProps {
  readonly name: string;
  readonly testing: boolean;
}

interface PipelineStackProps extends StackProps {
  readonly projectName: string;
  readonly selfMutating: boolean;
  readonly repositoryName: string;
  readonly branchName: string;
  readonly connectionArn: string;
  readonly stages: StageEnvironment[];
}

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const source = CodePipelineSource.connection(props.repositoryName, props?.branchName, {
      connectionArn: props?.connectionArn,
    });

    // Synth Step
    const synthStep = new ShellStep('Synth', {
      input: source,
      installCommands: [
        'yarn install --frozen-lockfile',
        'yarn bootstrap'
      ],
      commands: [
        'yarn build',
        'yarn lint',
        'CI=true yarn test',
        'yarn synth'
      ],
      primaryOutputDirectory: 'packages/infra/cdk.out',
    });

    const pipeline = new CodePipeline(this, 'Pipeline', {
      selfMutation: props.selfMutating,
      crossAccountKeys: true, // Encrypt artifacts, required for cross-account deployments
      synth: synthStep
    });

    for (const stage of props.stages) {
      // Adding Infra Stage
      const infra = new InfraStage(this, stage.name, {
        ...stage,
        pipelineAccount: this.account,
        projectName: props.projectName
      });
      const infraStage = pipeline.addStage(infra);
      // In case we are in a testing stage
      if (stage.testing) {
        infraStage.addPost(new CodeBuildStep('Functional Testing', {
          input: source,
          env: {
            STAGE: stage.name.toLowerCase(),
            REGION: infra.region || this.region
          },
          envFromCfnOutputs: {
            COGNITO_USER_POOL_ID: infra.userPoolId,
            COGNITO_APP_CLIENT_ID: infra.userPoolAppClientId,
            TEST_USER_SECRET_ARN: infra.testUserSecretArn,
            TEST_ADMIN_SECRET_ARN: infra.testAdminSecretArn,
            TESTING_ROLE_ARN: infra.testingRoleArn,
            API_URL: infra.apiUrl,
            DEMO_TABLE_NAME: infra.demoTableName
          },
          installCommands: [
            'yarn install --frozen-lockfile',
            'yarn bootstrap'
          ],
          commands: [
            'yarn build',
            'yarn create-test-user',
            'yarn test-functional'
          ],
          rolePolicyStatements: [ new PolicyStatement({
            resources: [ infra.testingRoleArn.value ],
            actions: [ 'sts:assumeRole' ],
          }) ]
        }));
      }
    }
  }
}
