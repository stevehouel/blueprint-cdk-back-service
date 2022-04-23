import { Construct } from 'constructs';
import { LambdaFunction, LambdaFunctionProps } from './LambdaFunction';
import { HttpApi, HttpMethod, IHttpRouteAuthorizer } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';


export interface ApiLambdaFunctionProps extends LambdaFunctionProps {
  readonly api: HttpApi,
  readonly method: HttpMethod;
  readonly path: string;
  readonly authorizer?: IHttpRouteAuthorizer;
}

/**
 * NodeJS Lambda function with project defaults, monitoring...
 */
export class ApiLambdaFunction extends LambdaFunction {

  constructor(scope: Construct, id: string, props: ApiLambdaFunctionProps) {
    super(scope, id, {
      ...props,
    });

    props.api.addRoutes({
      path: props.path,
      methods: [ props.method ],
      integration: new HttpLambdaIntegration(`${id}Integration`, this.liveAlias),
      authorizer: props.authorizer
    });
  }
}
