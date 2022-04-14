import SQS from 'aws-sdk/clients/sqs';

import { RecipientType, UserRecipient } from '../../notifications/models/notification';
import ConsumerController, {RecordProcessor} from '../consumer.controller';
import {ParsedRecord} from '../../utils/consumer.helpers';

const sendMessageBatchMock = jest.fn();
const sendMessageMock = jest.fn();
sendMessageBatchMock.mockReturnValue({
  promise: () => {
    return Promise.resolve();
  },
});
sendMessageMock.mockReturnValue({
  promise: () => {
    return Promise.resolve();
  },
});
SQS.prototype.sendMessageBatch = sendMessageBatchMock;
SQS.prototype.sendMessage = sendMessageMock;

describe('ConsumerController', () => {
  describe('consume', () => {
    it('should return a function that iterates over DynamoDB stream event records', async () => {
      class DummyProcessor extends RecordProcessor<string> {
        numberOfCalls = 0;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async process(record: ParsedRecord<string>) {
          this.numberOfCalls++;
          return {};
        }
      }
      const controller = new ConsumerController({
        dlqUrl: DLQ_URL,
      });

      const processor = new DummyProcessor();
      const consumerFunction = controller.consume(processor);
      await consumerFunction(DYNAMODB_STREAM_EVENT);

      expect(typeof consumerFunction).toStrictEqual('function');
      expect(processor.numberOfCalls).toEqual(1);
    });

    it('should send event to DLQ if error occurs during processing', async () => {
      class DummyProcessor extends RecordProcessor<string> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async process(record: ParsedRecord<string>) {
          throw new Error('Error during processing');
          return {};
        }
      }
      const controller = new ConsumerController({
        dlqUrl: DLQ_URL,
      });

      const processor = new DummyProcessor();
      const consumerFunction = controller.consume(processor);
      await consumerFunction(DYNAMODB_STREAM_EVENT);

      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledWith({
        QueueUrl: DLQ_URL,
        MessageBody: JSON.stringify({
          event: DYNAMODB_STREAM_EVENT,
          errorMessage: 'Error during processing',
        }),
      });
    });

    it('should dispatch notifications if they are enabled', async () => {
      const notification = {
        recipient: {
          userId: 'shouel',
          type: RecipientType.User,
        } as UserRecipient,
        subject: 'Welcome',
        content: 'Hello...',
      };

      const notifications = [
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...Array(11).fill(0).map(_ => notification),
      ];

      class DummyProcessor extends RecordProcessor<string> {
        numberOfCalls = 0;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async process(record: ParsedRecord<string>) {
          this.numberOfCalls++;
          return {
            notifications,
          };
        }
      }

      const controller = new ConsumerController({
        dlqUrl: DLQ_URL,
        notificationSettings: {
          queueUrl: QUEUE_URL,
        },
      });

      const processor = new DummyProcessor();
      await controller.consume(processor)(DYNAMODB_STREAM_EVENT);

      expect(sendMessageBatchMock).toHaveBeenCalledTimes(2);
    });
  });
});

const QUEUE_URL = 'https://sqs.eu-west-1.amazonaws.com/000000000000/MyQueue';
const DLQ_URL = 'https://sqs.eu-west-1.amazonaws.com/000000000000/MyDLQ';

const DYNAMODB_STREAM_EVENT = {
  Records: [
    {
      eventID: '5ffbf1698ade993be4da1b37a60a53e8',
      eventName: 'INSERT',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'us-west-2',
      dynamodb: {
        ApproximateCreationDateTime: 1631613493,
        Keys: {
          id: {
            S: 'c82a0a55-b572-43b0-a9d1-0604cb15e4b9',
          },
        },
        NewImage: {
          createdDate: {
            S: '2021-09-14T09:58:12.632Z',
          },
          id: {
            S: 'c82a0a55-b572-43b0-a9d1-0604cb15e4b9',
          },
          updatedDate: {
            S: '2021-09-14T09:58:12.632Z',
          },
          userId: {
            S: 'someone',
          },
          status: {
            S: 'OTHER_STATUS',
          },
        },
        SequenceNumber: '970195500000000017153833570',
        SizeBytes: 329,
        StreamViewType: 'NEW_AND_OLD_IMAGES',
      },
      eventSourceARN: 'arn:aws:dynamodb:eu-west-1:000000000000:table/MyTable/stream/2022-02-22T13:30:20.414',
    },
  ],
};