import { ApiController } from './api.controller';
import { FeedbackModel } from 'data-models';
import { validatePostFeedbackRequest } from '../validation/feedbacks';

const QUEUE_URL = process.env.QUEUE_URL || 'FeedbackQueue';

const api = new ApiController();
const feedbackModel = new FeedbackModel(QUEUE_URL);

/**
 * POST /feedback
 * Handler to create a new feedback.
 */
const post = api.handle(async (request) => {
  validatePostFeedbackRequest(request);

  const parsedFeedback = feedbackModel.parse(request.body);
  const { currentUserId } = request;
  const feedback = await feedbackModel.send({
    ...parsedFeedback,
    timestamp: new Date().toISOString(),
    userId: currentUserId,
  });
  return {
    statusCode: 202,
    body: feedback,
  };
});

export {
  post,
};