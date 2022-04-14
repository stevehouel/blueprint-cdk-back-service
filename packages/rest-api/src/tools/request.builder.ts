import { HandlerRequest } from '../handlers/api.controller';

/**
 * Build API Request to be used in unit tests
 * @param method HTTP method (GET, PUT, POST, DELETE, PATCH)
 * @param path HTTP path, ie /communities
 * @param pathParameters HTTP path parameters
 * @param queryParameters HTTP query parameters
 * @param body body of the HTTP query
 * @param jwtUsername userId acquired from JWT token
 * @param isAdmin flag indicating whether user has Admin role
 * @returns API Request object
 */
export const buildApiRequest = ({
                                  method = 'GET',
                                  path = '/',
                                  pathParameters = {},
                                  queryParameters = {},
                                  body = '',
                                  jwtUsername = 'testuser',
                                  isAdmin = false,
                                }: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path?: string,
  pathParameters?: Record<string, string>,
  queryParameters?: Record<string, string>,
  body?: Record<string, unknown> | string,
  jwtUsername?: string,
  isAdmin?: boolean,
}): HandlerRequest => {
  const inlineParameters = Object.keys(queryParameters).length > 0
    ? `?${Object.keys(queryParameters).map(k => `${k}=${queryParameters[k]}`).join('&')}`
    : '';
  const cognitoGroups: string[] = [
    ...(isAdmin ? [ 'Admin' ] : []),
  ];

  return {
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            username: jwtUsername,
            'cognito:groups': stringifyArray(cognitoGroups),
          },
        },
      },
      http: {
        method,
        path,
      },
    },
    queryStringParameters: queryParameters,
    pathParameters,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    rawPath: `${path}${inlineParameters}`,
    isAdmin,
    currentUserId: jwtUsername,
  };
};

const stringifyArray = (array: string[]) => {
  return `[${array.join(', ')}]`;
};