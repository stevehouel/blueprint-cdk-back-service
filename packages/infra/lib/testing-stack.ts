import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { AccountPrincipal, AccountRootPrincipal, CompositePrincipal, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';


export interface TestingProps extends StackProps {
  readonly pipelineAccount: string;
}

/**
 * CDK stack containing testing resources.
 */
export class TestingStack extends Stack {
  public testingRole: Role;
  public testingRoleArn: CfnOutput;

  constructor(scope: Construct, id: string, props: TestingProps) {
    super(scope, id, props);


    // ** Testing role **
    this.testingRole = new Role(this, 'TestingRole', {
      roleName: `${this.stackName}-TestingRole`,
      assumedBy: new CompositePrincipal(
        new AccountRootPrincipal(),
        new AccountPrincipal(props.pipelineAccount),
      ),
      description: 'Testing role that can be assumed to access testing resources.',
    });

    this.testingRoleArn = new CfnOutput(this, 'TestingRoleArn', {
      value: this.testingRole.roleArn,
    });
  }
}
