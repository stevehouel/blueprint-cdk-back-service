import http from 'http';
import * as AWS from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk';
AWSXRay.captureAWS(AWS);
AWSXRay.captureHTTPsGlobal(http);
AWSXRay.capturePromise();
import { APIError } from 'data-models';

const defaultHeaders = { 'Content-Type': 'application/json' };

export const COGNITO_ADMIN_GROUP = process.env.COGNITO_ADMIN_GROUP || 'Admin';

/**
 * Class used to define HTTP API Lambda handlers.
 */
export class ApiController {
  private logger: Console;

  /**
   * Create a new APIController.
   * @param logger object used to log.
   */
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Handle the handler function with optional a community role permission check (logging, request, response...).
   * @param handler Handler function.
   * @param role Community expected roles
   */
  handle<R extends HandlerRequest>(handler: PartialHandler<R>): Handler {
    return async (lambdaRequest: APIRequest) => {
      try {
        const { method, path } = lambdaRequest.requestContext.http;
        this.logger.info(`Handling: ${method} ${path}`);
        this.logger.info(`API Gateway RequestId: ${lambdaRequest.requestContext.requestId}`);
        if (lambdaRequest.body) {
          this.logger.info(`Payload: ${JSON.stringify(lambdaRequest.body)}`);
        }
        this.logger.info(`Requester: ${lambdaRequest.requestContext.authorizer.jwt.claims.username}`);
        if (lambdaRequest.queryStringParameters) {
          this.logger.info(`Query parameters: ${JSON.stringify(lambdaRequest.queryStringParameters)}`);
        }
        if (lambdaRequest.pathParameters) {
          this.logger.info(`Path parameters: ${JSON.stringify(lambdaRequest.pathParameters)}`);
        }

        const request = lambdaRequest as R;
        request.isAdmin = this.isPartOfAdminGroup(request);
        request.currentUserId = this.getUsername(request);

        const resp = await handler(request);
        return {
          statusCode: resp.statusCode || 200,
          body: JSON.stringify(resp.body || {}),
          headers: { ...defaultHeaders, ...resp.headers },
        };
      } catch (error) {
        this.logger.error(error);

        const response = {
          statusCode: 500,
          body: JSON.stringify({ message: 'Internal error, please re-try.' }),
          headers: defaultHeaders,
        };
        if (error instanceof APIError) {
          response.statusCode = error.statusCode;
          response.body = JSON.stringify({ message: error.toString() });
        }
        return response;
      }
    };
  }

  /**
   * Get user admin status from request.
   * @param request Request to be processed.
   */
  private isPartOfAdminGroup(request: APIRequest): boolean {
    const groups = (request.requestContext.authorizer.jwt.claims['cognito:groups'] || '').replace(/\[|\]/g,'').split(' ');
    return groups.find(g => g === COGNITO_ADMIN_GROUP) !== undefined;
  }

  /**
   * Get current username from request.
   * @param request Request to be processed.
   */
  getUsername(request: APIRequest) {
    return request.requestContext.authorizer.jwt.claims.username.replace('AMZN_', '');
  }

  /**
   * Memoize the return value of a promise. This allow to keep result of previous dynamodb call.
   * @param modelFunction Promise function to be memoized.
   */
  static memoizeResponse<T>(modelFunction: () => Promise<T>): () => Promise<T> {
    return () => {
      let response: Promise<T> | undefined;
      if (!response) {
        response = modelFunction();
      }
      return response;
    };
  }
}

/**
 * HTTP Api event request: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
export interface APIRequest {
  requestContext: {
    authorizer: {
      jwt: {
        claims: {
          username: string;
          'cognito:groups': string;
        }
      }
    },
    http: {
      method: string;
      path: string;
    },
    /** Temporary field to correlate API Gateway requests with Lambda invocation. */
    requestId?: string;
  },
  pathParameters: {
    [name: string]: string;
  },
  queryStringParameters?: {
    [name: string]: string;
  }
  body: string;
  rawPath: string;
}

/** Handler request */
export interface HandlerRequest extends APIRequest {
  /** Id of the current user. */
  currentUserId: string;
  /** Current user Admin status. */
  isAdmin: boolean;
  /** Store the subjects making the request (ie: currentMember...). */
  subjects?: {
    [subject: string]: () => Promise<any>;
  },
  /** Store the resources needed to process the request (ie: activity, member, communityId...). */
  resources?: {
    [resource: string]: (() => Promise<any>) | Record<string, any> | string;
  }
}

/**
 * Handler HTTP Api response: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
export interface HandlerResponse {
  statusCode: number,
  headers: { [name: string]: string },
  body: string,
}

/**
 * Handler response before the handle function.
 */
export interface PartialHandlerResponse{
  body?: unknown,
  statusCode?: number,
  headers?: { [name: string]: string },
}

export type Handler = (request: APIRequest) => Promise<HandlerResponse>;
export type PartialHandler<R extends HandlerRequest> = (request: R) => Promise<PartialHandlerResponse>;