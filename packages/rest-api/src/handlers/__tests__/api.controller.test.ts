import { post } from '../feedback.handler';
import { FeedbackModel, Feedback } from 'data-models';
import { APIRequest } from '../api.controller';
import { buildApiRequest } from '../../tools/request.builder';

describe('members handlers', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global.console, 'error').mockImplementation(() => { }); // eslint-disable-line
    jest.spyOn(global.console, 'log').mockImplementation(() => { }); // eslint-disable-line
    jest.spyOn(global.console, 'info').mockImplementation(() => { }); // eslint-disable-line
  });

  describe('POST /feedback', () => {
    it('should return 202 if the http body is a feedback', async () => {
      const request = buildPostFeedbackRequest({ body: FEEDBACK_1 });
      jest.spyOn(FeedbackModel.prototype, 'send').mockImplementation(() => Promise.resolve(FEEDBACK_1));
      const resp = await post(request);
      expect(resp).toEqual(expect.objectContaining({
        statusCode: 202,
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(JSON.parse(resp.body)).toEqual(FEEDBACK_1);
    });

    it('should return 400 if the http body is an invalid json ', async () => {
      const request = buildPostFeedbackRequest({ body: '{{{{{{JSON' });
      jest.spyOn(FeedbackModel.prototype, 'send').mockImplementation(() => Promise.resolve(FEEDBACK_1));
      const resp = await post(request);
      expect(resp).toEqual(expect.objectContaining({
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('should return 500 if SQS client throws an error', async () => {
      const request = buildPostFeedbackRequest({ body: FEEDBACK_1 });
      jest.spyOn(FeedbackModel.prototype, 'send').mockImplementation(() => Promise.reject());
      const resp = await post(request);
      expect(resp).toEqual(expect.objectContaining({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    const buildPostFeedbackRequest = ({
                                        body,
                                      }: {
      body: Feedback | string,
    }): APIRequest => buildApiRequest({
      method: 'POST',
      path: '/feedback',
      body: body as any,
    });
  });
});

const FEEDBACK_1: Feedback = {
  userId: 'usertester',
  rating: 5,
  message: 'Feedback message',
  timestamp: '2020-11-11T10:04:54.360Z',
};