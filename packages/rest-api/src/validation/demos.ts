import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {RequestValidationFunction, validateRequestBody, validateRequestPathParams} from './request.validation';
import DemoSchema from './schemas/demo.schema.json';
import {BadRequestError} from 'data-models';

const ajv = new Ajv();
addFormats(ajv);

/**
 * Validate get all communities API request
 * @param request API request
 */
export const validateGetAllDemosRequest: RequestValidationFunction = () => {
  return;
};

const validateGetDemoPathParameters = ajv.compile({
  type: 'object',
  required: [
    'id',
  ],
  properties: {
    id: DemoSchema.properties.id,
  },
  additionalProperties: false,
});

/**
 * Validate get demo API request
 * @param request API request
 */
export const validateGetDemoRequest: RequestValidationFunction = (request) => {
  validateRequestPathParams({
    request,
    validateFunction: validateGetDemoPathParameters,
  });
};

const validatePostDemoBody = ajv.compile({
  type: 'object',
  required: [
    'userId',
  ],
  properties: DemoSchema.properties,
  additionalProperties: false,
});

/**
 * Validate post demo API request
 * @param request API request
 */
export const validatePostDemoRequest: RequestValidationFunction = (request) => {
  validateRequestBody({
    request,
    validateFunction: validatePostDemoBody,
  });
};

const validatePutDemoBody = ajv.compile({
  type: 'object',
  required: [
    'id',
    'entityId',
    'version',
    'userId',
    'demoStatus'
  ],
  properties: DemoSchema.properties,
  definitions: DemoSchema.definitions,
  additionalProperties: false,
});

const validatePutDemoPathParameters = ajv.compile({
  type: 'object',
  required: [
    'id',
  ],
  properties: {
    id: DemoSchema.properties.id,
  },
  additionalProperties: false,
});

/**
 * Validate put Demo API request
 * @param request API request
 */
export const validatePutDemoRequest: RequestValidationFunction = (request) => {
  validateRequestPathParams({
    request,
    validateFunction: validatePutDemoPathParameters,
  });
  validateRequestBody({
    request,
    validateFunction: validatePutDemoBody,
  });
  const parsedDemo = JSON.parse(request.body);
  if (request.pathParameters.id !== parsedDemo.id) {
    throw new BadRequestError("Demo id in the URL path doesn't match DemoId in the request body");
  }
};

const validateDeleteDemoPathParameters = ajv.compile({
  type: 'object',
  required: [
    'id',
  ],
  properties: {
    id: DemoSchema.properties.id,
  },
  additionalProperties: false,
});

/**
 * Validate delete demo API request
 * @param request API request
 */
export const validateDeleteDemoRequest: RequestValidationFunction = (request) => {
  validateRequestPathParams({
    request,
    validateFunction: validateDeleteDemoPathParameters,
  });
};