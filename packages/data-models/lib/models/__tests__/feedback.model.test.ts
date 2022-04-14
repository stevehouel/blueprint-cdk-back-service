import SQS from 'aws-sdk/clients/sqs';

import { FeedbackModel, Feedback } from '../feedback.model';
import { BadRequestError } from '../errors';

describe('FeedbackModel', () => {
  it('should create a new model', () => {
    const feedbackModel = new FeedbackModel('https://FakeQueueURL');
    expect(feedbackModel).toHaveProperty('client');
    expect(feedbackModel).toHaveProperty('queueURL');
  });

  describe('methods', () => {
    const mockClient = {
      sendMessage: jest.fn(),
    };

    const feedbackModel = new FeedbackModel('https://FakeQueueURL', mockClient as unknown as SQS);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('send', () => {
      it('should call sendMessage', async () => {
        mockClient.sendMessage.mockReturnValue({ promise: () => Promise.resolve() });
        expect(feedbackModel.send(FEEDBACK)
          .then(resp => {
            expect(mockClient.sendMessage).toBeCalled();
            expect(resp).toEqual(FEEDBACK);
          }));
      });
    });

    describe('parse', () => {
      it('should parse a valid object', () => {
        expect(feedbackModel.parse(JSON.stringify(FEEDBACK)))
          .toEqual(FEEDBACK);
      });

      it('should throw on invalid JSON', () => {
        return expect(() => feedbackModel.parse('{{{{{{{invalidJSON'))
          .toThrow(BadRequestError);
      });

      it('should throw on invalid format', () => {
        return expect(() => feedbackModel.parse(JSON.stringify({})))
          .toThrow(BadRequestError);
      });

      it('should throw on object with too much attributes', () => {
        return expect(() => feedbackModel.parse(JSON.stringify({ ...FEEDBACK, invalid: true })))
          .toThrow(BadRequestError);
      });
    });
  });
});

const FEEDBACK: Feedback = {
  userId: 'hilalymh',
  rating: 5,
  timestamp: '2020-11-11T10:04:54.360Z',
};
