import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { RequestValidationFunction, validateRequestBody } from './request.validation';
import FeedbackSchema from './schemas/feedback.schema.json';

const ajv = new Ajv();
addFormats(ajv);

const validatePostFeedbackBody = ajv.compile({
  type: 'object',
  required: [
    'rating',
  ],
  properties: FeedbackSchema.properties,
  additionalProperties: false,
});

/**
 * Validate post feedback API request
 * @param request API request
 */
export const validatePostFeedbackRequest: RequestValidationFunction = (request) => {
  validateRequestBody({
    request,
    validateFunction: validatePostFeedbackBody,
  });
};