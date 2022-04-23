import * as api from '@aws-cdk/aws-apigatewayv2-alpha';
import { Construct } from 'constructs';
import { CorsHttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Duration } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';

export class HttpApi extends api.HttpApi {

  public readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: api.HttpApiProps) {
    super(scope, id, {
      corsPreflight: {
        allowHeaders: [ 'Authorization', 'Content-Type' ],
        allowMethods: [ CorsHttpMethod.GET, CorsHttpMethod.OPTIONS, CorsHttpMethod.POST, CorsHttpMethod.DELETE, CorsHttpMethod.PUT, CorsHttpMethod.PATCH ],
        allowOrigins: [ '*' ],
        maxAge: Duration.hours(1),
      },
      disableExecuteApiEndpoint: true,
      ...props,
    });

    this.logGroup = new LogGroup(this, 'ApiAccessLogGroup', {
      retention: RetentionDays.TEN_YEARS,
    });

    const apiStage: CfnStage | undefined = this.defaultStage?.node.defaultChild as CfnStage;
    if (apiStage) {
      apiStage.defaultRouteSettings = {
        ...apiStage.defaultRouteSettings,
        detailedMetricsEnabled: true,
      };
      apiStage.accessLogSettings = {
        destinationArn: this.logGroup.logGroupArn,
        format: '{ "httpMethod":"$context.httpMethod",' +
          '"routeKey":"$context.routeKey",' +
          '"status":"$context.status",' +
          '"protocol":"$context.protocol", ' +
          '"responseLength":"$context.responseLength", ' +
          '"requestTime":"$context.requestTime", ' +
          '"requestId":"$context.requestId", ' +
          '"errorMessage":"$context.error.message" }',
      };
    }
  }

}
