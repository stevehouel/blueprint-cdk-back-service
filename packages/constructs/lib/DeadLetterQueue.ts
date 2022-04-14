import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';


export type DeadLetterQueueProps = QueueProps

/**
 * SQS Queue with alarming.
 */
export class DeadLetterQueue extends Queue {
  public readonly messagesAlarm: Alarm;

  constructor(scope: Construct, id: string, props: DeadLetterQueueProps) {
    super(scope, id, {
      ...props,
      encryption: QueueEncryption.KMS_MANAGED,
    });

    this.messagesAlarm = new Alarm(scope, `${id}MessagesAlarm`, {
      metric: this.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
    });
  }
}
