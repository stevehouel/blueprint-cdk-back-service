import { APIRequest } from '../handlers/api.controller';
import { ValidateFunction } from 'ajv';
import { BadRequestError } from 'data-models';

/**
 * Request Validation Function type
 */
export type RequestValidationFunction = (request: APIRequest) => void;

/**
 * Validate API request with given path validation function
 * @param request API request available in API handler function
 * @param validateFunction function validating path parameters
 * @throws BadRequestError if validation had failed
 */
export const validateRequestPathParams = ({
                                            request,
                                            validateFunction,
                                          }: {
  request: APIRequest,
  validateFunction: ValidateFunction,
}) => {
  if (!validateFunction(request.pathParameters || {})) {
    throw new BadRequestError(`Request path parameters ${getErrorMessage(validateFunction)}`);
  }
};

/**
 * Validate API request with given query validation function
 * @param request API request available in API handler function
 * @param validateFunction function validating query parameters
 * @throws BadRequestError if validation had failed
 */
export const validateRequestQueryParams = ({
                                             request,
                                             validateFunction,
                                           }: {
  request: APIRequest,
  validateFunction: ValidateFunction,
}) => {
  if (!validateFunction(request.queryStringParameters || {})) {
    throw new BadRequestError(`Request query parameters ${getErrorMessage(validateFunction)}`);
  }
};

/**
 * Validate API request with given body validation function
 * @param request API request available in API handler function
 * @param validateFunction function validating request body
 * @throws BadRequestError if validation had failed
 */
export const validateRequestBody = ({
                                      request,
                                      validateFunction,
                                    }: {
  request: APIRequest,
  validateFunction: ValidateFunction,
}) => {
  let parsedBody;
  try {
    parsedBody = JSON.parse(request.body);
  } catch {
    throw new BadRequestError('Invalid JSON in request body');
  }

  if (!validateFunction(parsedBody || {})) {
    throw new BadRequestError(`Request body ${getErrorMessage(validateFunction)}`);
  }
};

/**
 * Gets error message for validation function result
 * @param validate validation function
 * @returns error message:
 *   - if propertyName is present, the message is like: 'userId' should match pattern
 *   - if propertyName is not present, the message is like: 'userId' should match pattern
 */
const getErrorMessage = (validate: ValidateFunction) => {
  if (validate.errors && validate.errors[0].message) {
    if (validate.errors[0].propertyName) {
      return `property '${validate.errors[0].propertyName}' ${validate.errors[0].message}`;
    } else {
      return validate.errors[0].message;
    }
  } else {
    return 'Validation error';
  }
};

/**
 * Gets property name from data path
 * @param dataPath data path, looks like '/userId'
 * @returns property name, like 'userId'
 */
const dataPathToPropertyName = (dataPath: string) => {
  const pathSegments = dataPath.split('/');
  return pathSegments[pathSegments.length - 1];
};