import { Construct } from 'constructs';
import { LambdaFunction, LambdaFunctionProps } from './LambdaFunction';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IRestApi } from 'aws-cdk-lib/aws-apigateway/lib/restapi';


export interface ApiLambdaFunctionProps extends LambdaFunctionProps {
  readonly api: IRestApi,
  readonly method?: string;
  readonly path?: string;
  readonly stage?: string;
}

/**
 * NodeJS Lambda function with project defaults, monitoring...
 */
export class ApiLambdaFunction extends LambdaFunction {

  constructor(scope: Construct, id: string, props: ApiLambdaFunctionProps) {
    super(scope, id, {
      ...props,
    });

    this.addPermission(`${id}Permission`, {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      scope: props.api,
      sourceArn: props.api.arnForExecuteApi(props.method, props.path, props.stage)
    });
  }
}
