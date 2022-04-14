import { createHash } from 'crypto';
import SQS from 'aws-sdk/clients/sqs';

import { ParsedRecord, parseRecord } from '../utils/consumer.helpers';
import { NotificationIntent } from '../notifications/models/notification';

const MAX_MESSAGES = 10;

interface ConsumerControllerParams {
  logger?: Console;
  notificationSettings?: {
    queueUrl: string;
  };
  dlqUrl: string;
}
const DEFAULT_PARAMS = {
  logger: console,
};

/**
 * Class used to define DynamoDB stream consumers.
 */
export default class ConsumerController {
  private logger: Console;
  private dlqUrl: string;
  private sqsClient: SQS;
  private notificationSettings?: {
    queueUrl: string;
  };

  constructor(params: ConsumerControllerParams) {
    const paramsWithDefaults = { ...params, ...DEFAULT_PARAMS };
    this.logger = paramsWithDefaults.logger;
    this.dlqUrl = paramsWithDefaults.dlqUrl;
    this.sqsClient = new SQS({});

    if (paramsWithDefaults.notificationSettings) {
      this.notificationSettings = { ...paramsWithDefaults.notificationSettings };
    }
  }

  /**
   * Returns a function that manages consumption of DynamoDB stream records for a particular table.
   * @param processor Class that performs the required operations at the stream record level.
   * @returns Consumer function.
   */
  consume<T>(processor: RecordProcessor<T>): Consumer {
    return async (event: any) => {
      this.logger.info(`Handling event: ${JSON.stringify(event)}`);

      try {
        const notifications: NotificationIntent[] = [];

        for (const record of event.Records) {
          const parsedRecord = parseRecord<T>(record);
          const results = await processor.process(parsedRecord);
          notifications.push(...(results.notifications || []));
        }

        if (this.notificationSettings && notifications.length) {
          this.logger.info(`Dispatching notifications: ${JSON.stringify(notifications)}`);
          for (let startPosition = 0; startPosition < notifications.length; startPosition += MAX_MESSAGES) {
            await this.sqsClient.sendMessageBatch({
              QueueUrl: this.notificationSettings.queueUrl,
              Entries: notifications.slice(startPosition, startPosition + MAX_MESSAGES).map(n => ({
                Id: createHash('md5').update(`${n.subject}-${JSON.stringify(n.recipient)}`).digest('hex'),
                MessageBody: JSON.stringify(n),
                MessageGroupId: createHash('md5').update(JSON.stringify(n.recipient)).digest('hex'),
              })),
            }).promise();
          }
        }
      } catch (error: any) {
        console.error(error);
        // Send event to the DLQ for later replay if needed
        await this.sqsClient.sendMessage({
          QueueUrl: this.dlqUrl,
          MessageBody: JSON.stringify({
            event,
            errorMessage: error.message,
          }),
        }).promise();
      }
    };
  }
}

/**
 * Interface representing values returned by the `process` method of a RecordProcessor implementation
 */
interface ProcessingResults {
  // Notifications that need to be dispatched by the controller.
  notifications?: NotificationIntent[];
}

/**
 * Abstract class that should be extended to create processors for the different record type.
 */
export abstract class RecordProcessor<T> {
  /**
   * Executes any business logic required to respond to the input record change, such as updating
   * other objects, generating notifications...
   * @param record Parsed record from a DynamoDB stream event
   * @returns Promise containing outputs which can be used by the Controller (e.g. notifications)
   */
  abstract process(record: ParsedRecord<T>): Promise<ProcessingResults>;
}

export type Consumer = (event: any) => Promise<void>;