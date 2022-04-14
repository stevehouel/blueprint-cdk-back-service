import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Alarm, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { StateMachineType } from 'aws-cdk-lib/aws-stepfunctions';
import { Duration } from 'aws-cdk-lib';

export type StateMachineProps = sfn.StateMachineProps

/**
 * Step function with project defaults, monitoring...
 */
export class StateMachine extends sfn.StateMachine {
  public readonly errorAlarm: Alarm;
  public readonly timeoutWarning: Alarm;

  constructor(scope: Construct, id: string, props: StateMachineProps) {
    super(scope, id, {
      stateMachineType: StateMachineType.STANDARD,
      tracingEnabled: true,
      ...props,
    });

    this.errorAlarm = new Alarm(scope, `${id}ErrorAlarm`, {
      metric: this.metricFailed(),
      threshold: 3,
      evaluationPeriods: 2,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    this.timeoutWarning = new Alarm(scope, `${id}TimeoutWarning`, {
      metric: this.metricTimedOut({ statistic: 'p90', period: Duration.minutes(1) }),
      threshold: 2000,
      evaluationPeriods: 3,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
  }
}
