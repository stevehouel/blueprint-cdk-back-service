import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

export const EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND';

/**
 * Class providing functionality to query Cognito users.
 */
export class CognitoGateway {
  provider: CognitoIdentityProviderClient;
  userPoolId: string;

  /**
   * Create a new Cognito Gateway.
   * @param userPoolId user pool to be queried.
   * @param provider Cognito Identity service provider.
   */
  constructor(userPoolId: string, provider: CognitoIdentityProviderClient) {
    this.provider = provider;
    this.userPoolId = userPoolId;
  }

  /**
   * Obtain user attributes.
   * @param username to fetch attributes for.
   */
  getAttributes(username: string) {
    const command = new AdminGetUserCommand({
      UserPoolId: this.userPoolId,
      Username: username,
    });
    return this.provider.send(command)
      .then((user: any) => {
        if (!user.Username) {
          throw new Error(`User not found: ${username}`);
        }

        const attributes = user.UserAttributes.reduce((map: any, attribute: any) => {
          map[attribute.Name] = attribute.Value;
          return map;
        }, { });

        attributes['username'] = username;

        return attributes;
      });
  }

  /**
   * Obtain user email
   * @param username to fetch attributes for. Will be prefixed with AMZN_
   * @param useDefault boolean stating if default email needs to be used when user not found.
   */
  async getUserEmail(username: string, useDefault = true) {
    let email = '';
    try {
      const cognitoAttributes = await this.getAttributes(username);
      email = cognitoAttributes['email'];
    } catch(error: any) {
      if (error.name === 'UserNotFoundException') {
        console.log(`User not found in Cognito: ${username}`);
        if (!useDefault) {
          email = EMAIL_NOT_FOUND;
        }
      } else {
        throw error;
      }
    }
    return email;
  }
}
