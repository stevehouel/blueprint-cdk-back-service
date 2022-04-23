import {Duration, NestedStack, NestedStackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
  CfnAlarm,
  CfnAnomalyDetector,
  Color, ComparisonOperator,
  Dashboard,
  GraphWidget,
  GRID_WIDTH, HorizontalAnnotation,
  IWidget,
  MathExpression,
  Metric,
  Statistic,
  TextWidget, TreatMissingData
} from 'aws-cdk-lib/aws-cloudwatch';
import {HttpApi, LambdaFunction} from 'project-constructs';
import {HTTP_4XX_ERROR} from './rest-api-stack';

export interface DashboardsStackProps extends NestedStackProps {
  readonly projectName: string;
  readonly api: HttpApi;
  readonly lambdaFunctions: LambdaFunction [];
}

export interface ApiGatewayMetricInfo {
  method: string;
  resource: string;
}

export class OperationalStack extends NestedStack {
  constructor(scope: Construct, id: string, props: DashboardsStackProps) {
    super(scope, id, props);
    // ** CW Alarms **
    const apiCountAnomalyDetectorMetricId = 'apiCountAnomalyDetectorMetricId';

    const apiCountAnomalyDetector = new CfnAnomalyDetector(this, 'ApiGatewayCountAnomalyDetector', {
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      stat: 'SampleCount',
      dimensions: [{ name: 'ApiId', value: props.api.apiId }],
    });

    new CfnAlarm(this, 'ApiGatewayCountAnomalyDetectionAlarm', {
      metrics: [
        {
          id: apiCountAnomalyDetectorMetricId,
          expression: 'ANOMALY_DETECTION_BAND(exp1, 15)',
        },
        {
          id: 'exp1',
          metricStat: {
            metric: {
              namespace: apiCountAnomalyDetector.namespace,
              metricName: apiCountAnomalyDetector.metricName,
              dimensions: apiCountAnomalyDetector.dimensions,
            },
            period: 300,
            stat: apiCountAnomalyDetector.stat || 'SampleCount',
          },
        },
      ],
      comparisonOperator: ComparisonOperator.LESS_THAN_LOWER_OR_GREATER_THAN_UPPER_THRESHOLD,
      evaluationPeriods: 5,
      thresholdMetricId: apiCountAnomalyDetectorMetricId,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmActions: [],
    });

    // ** CW Dashboard **
    const dashboard = new Dashboard(this, 'BackendDashboard', {
      dashboardName: `${props.projectName}-Backend`,
    });

    const lambdaErrorWidgets: IWidget[] = [];
    props.lambdaFunctions.forEach(lambdaFunction => {
      lambdaErrorWidgets.push(lambdaFunction.errorWidget);
    });

    const requestCount = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      statistic: Statistic.SUM,
      period: Duration.seconds(300),
      dimensionsMap: { ApiId: props.api.httpApiId },
    });
    const requestFailures5xxCount = new Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5xx',
      statistic: Statistic.SUM,
      period: Duration.seconds(300),
      dimensionsMap: { ApiId: props.api.httpApiId },
    });

    dashboard.addWidgets(
      new TextWidget({
        markdown: '# API Gateway Metrics',
        width: GRID_WIDTH,
        height: 1,
      }),
      new GraphWidget({
        width: 12,
        height: 6,
        title: 'Aggregate Call Volume',
        left: [
          requestCount,
        ],
      }),
      new GraphWidget({
        width: 12,
        height: 6,
        title: 'Aggregate Availability',
        left: [
          new MathExpression({
            label: 'Availability',
            expression: '100 * (1 - errors / requests)',
            period: Duration.seconds(300),
            usingMetrics: {
              errors: requestFailures5xxCount,
              requests: requestCount,
            },
          }),
        ],
        leftAnnotations: [
          { value: 99.95, label: 'SLA 99.95%', color: Color.RED },
        ],
      }),
      this.apiGatewayLatencyWidget(props.api, 'GET API [Latency p90]', 'Latency', 'p90',{ value: 500, label: 'SLA' }, [ 'GET' ]),
      this.apiGatewayLatencyWidget(props.api, 'POST + PUT + DELETE API [Latency p90]', 'Latency', 'p90',{ value: 1000, label: 'SLA' }, [ 'POST', 'PUT', 'DELETE', 'PATCH' ]),
      this.apiGatewayLatencyWidget(props.api, 'API [5XX Sum]', '5xx', 'Sum', undefined, [ 'GET', 'POST', 'PUT', 'DELETE', 'PATCH' ]),
      this.apiGatewayLatencyWidget(props.api, 'API [4XX Sum]', '4xx', 'Sum', undefined, [ 'GET', 'POST', 'PUT', 'DELETE', 'PATCH' ]),
      new TextWidget({
        markdown: '# Lambda Metrics',
        width: GRID_WIDTH,
        height: 1,
      }),
      ...lambdaErrorWidgets,
    );
  }

  apiGatewayLatencyWidget(api: HttpApi, title: string, metricName: string, statistic: string, annotation: HorizontalAnnotation | undefined, methods: string[]): GraphWidget {
    const API_GATEWAY_ROUTES = [
      { method: 'POST', resource: '/feedbacks' } as ApiGatewayMetricInfo,
      { method: 'GET', resource: '/demos' } as ApiGatewayMetricInfo,
      { method: 'POST', resource: '/demos' } as ApiGatewayMetricInfo,
      { method: 'GET', resource: '/demos/{id}' } as ApiGatewayMetricInfo,
      { method: 'PUT', resource: '/demos/{id}' } as ApiGatewayMetricInfo,
      { method: 'DELETE', resource: '/demos/{id}' } as ApiGatewayMetricInfo,
    ];
    const filteredRoutes = API_GATEWAY_ROUTES.filter(({ method }) => methods.includes(method));
    const widget = new GraphWidget({
      width: GRID_WIDTH,
      height: 6,
      title,
      left: [],
      leftAnnotations: annotation ? [ annotation ] : undefined,
    });
    for (const route of filteredRoutes) {
      widget.addLeftMetric(new Metric({
        dimensionsMap: { Method: route.method, Resource: route.resource, ApiId: api.apiId, Stage: api.defaultStage?.stageName || '' },
        namespace: 'AWS/ApiGateway',
        metricName,
        statistic,
        period: Duration.seconds(300),
      }));
    }
    if (metricName === '4xx') {
      widget.addLeftMetric(new Metric({
        namespace: 'API',
        metricName: HTTP_4XX_ERROR,
        statistic,
        period: Duration.seconds(300),
        label: 'All 4XX (excluding 401, 403 and 404)',
      }));
    }
    return widget;
  }
}
