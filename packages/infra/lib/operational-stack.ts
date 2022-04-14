import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';


export interface OperationalProps extends StackProps {
  readonly infraStackName: string;
}

/**
 * CDK stack containing operational resources.
 */
export class OperationalStack extends Stack {


  constructor(scope: Construct, id: string, props: OperationalProps) {
    super(scope, id, props);

    // Enabling DevOPs Guru for our backend resources
  }
}
