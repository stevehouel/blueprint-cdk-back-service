import { BadRequestError, Feedback } from 'data-models';
import { buildApiRequest } from '../../tools/request.builder';
import { validatePostFeedbackRequest } from '../feedbacks';

describe('Feedbacks validation', () => {
  describe('validatePostFeedbackRequest', () => {
    it('should pass valid request', () => {
      const validate = () => validatePostFeedbackRequest(buildApiRequest({
        body: FEEDBACK as any,
      }));
      expect(validate).not.toThrow();
    });

    it('should throw if body is empty', () => {
      const validate = () => validatePostFeedbackRequest(buildApiRequest({
        body: {},
      }));
      expect(validate).toThrow(BadRequestError);
      expect(validate).toThrow(/Request body must have required property 'rating'/);
    });

    it('should throw if body is invalid', () => {
      const validate = () => validatePostFeedbackRequest(buildApiRequest({
        body: {
          ...FEEDBACK,
          rating: 99,
        } as any,
      }));
      expect(validate).toThrow(BadRequestError);
      expect(validate).toThrow(/Request body must be <= 5/);
    });
  });
});

const FEEDBACK: Feedback = {
  rating: 5,
  userId: 'shouel',
  message: 'Good job',
  timestamp: '2020-11-17T00:00:00.000Z',
};