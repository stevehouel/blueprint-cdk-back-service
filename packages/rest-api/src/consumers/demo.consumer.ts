import ConsumerController from './consumer.controller';
import DemoRecordProcessor from './processors/demo.processor';
import {DemoItem} from 'data-models';

const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL || 'NotificationURL';
const DLQ_QUEUE_URL = process.env.DLQ_QUEUE_URL || 'DlqUrl';
const processor = new DemoRecordProcessor();

const controller = new ConsumerController({
  dlqUrl: DLQ_QUEUE_URL,
  notificationSettings: {
    queueUrl: NOTIFICATION_QUEUE_URL,
  },
});

/**
 * Handler of the consumer Lambda function.
 * @param processor Instance of a Demo record processor
 */
const consume = controller.consume<DemoItem>(processor);

export { consume };