import { Stack, StackProps } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { InfraStage, InfraStageProps } from './infra-stage';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

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
        'make install'
      ],
      commands: [
        'make build',
        'make lint',
        'CI-true make test',
        'make synth'
      ],
      primaryOutputDirectory: 'packages/infra/cdk.out',
    });

    const pipeline = new CodePipeline(this, 'pipeline', {
      selfMutation: props.selfMutating,
      crossAccountKeys: true, // Encrypt artifacts, required for cross-account deployments
      synth: synthStep,
    });

    for (const stage of props.stages) {
      // Adding Infra Stage
      const infra = new InfraStage(this, stage.name, {
        ...stage,
        pipelineAccount: this.account
      });
      const infraStage = pipeline.addStage(infra);
      // In case we are in a testing stage
      if (stage.testing) {
        infraStage.addPost(new CodeBuildStep('Functional Testing', {
          input: synthStep.addOutputDirectory('./'),
          env: {
            STAGE: stage.name.toLowerCase()
          },
          commands: [
            'make test-functionality'
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
