import * as api from '@aws-cdk/aws-apigatewayv2-alpha';
import { Construct } from 'constructs';
import { CorsHttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Duration } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

export class HttpApi extends api.HttpApi {

  constructor(scope: Construct, id: string, props: api.HttpApiProps) {
    super(scope, id, {
      corsPreflight: {
        allowHeaders: [ 'Authorization', 'Content-Type' ],
        allowMethods: [ CorsHttpMethod.GET, CorsHttpMethod.OPTIONS, CorsHttpMethod.POST, CorsHttpMethod.DELETE, CorsHttpMethod.PUT, CorsHttpMethod.PATCH ],
        allowOrigins: [ '*' ],
        maxAge: Duration.hours(1),
      },
      ...props,
    });
  }

}
