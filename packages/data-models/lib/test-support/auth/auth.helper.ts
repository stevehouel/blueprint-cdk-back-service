import AWS from 'aws-sdk';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';
import { ConfigParameters, Config } from '../config/config';

export interface JwtTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export enum TestUserType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

/**
 * Authenticate the tester account with Cognito and retrieve the JWT tokens.
 * @param configuration Tests configuration.
 */
export async function getCognitoUserTokens(configuration: ConfigParameters, userType: TestUserType): Promise<JwtTokens> {
  const { username, password } = await getTestUserCredentials(configuration, userType);
  const userPool = new CognitoUserPool({
    UserPoolId: configuration.cognitoUserPool,
    ClientId: configuration.cognitoClientId,
  });
  const cognitoUser = new CognitoUser({
    Pool: userPool,
    Username: username,
  });
  const authDetails = new AuthenticationDetails({
    Username: username,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        });
      },
      onFailure: (error) => reject(error),
    });
  });
}

/**
 * Create the test user based on the configuration secret.
 * @param configuration Tests configuration.
 */
async function createTestUsers(configuration: ConfigParameters) {
  const cognito = new AWS.CognitoIdentityServiceProvider({ region: configuration.region });

  const createUser = async ({
    username, password, givenName, familyName,
  }: {
    username: string,
    password: string,
    givenName: string,
    familyName: string,
  }) => {
    try {
      console.log(`Creating user ${username}`);
      await cognito.adminCreateUser({
        UserPoolId: configuration.cognitoUserPool,
        Username: username,
        UserAttributes: [
          { Name: 'email', Value: `test_${username}@amazon.com` },
          { Name: 'given_name', Value: givenName },
          { Name: 'family_name', Value: familyName }
        ],
      }).promise();

      console.log(`Set password for user ${username}`);
      await cognito.adminSetUserPassword({
        UserPoolId: configuration.cognitoUserPool,
        Username: username,
        Password: password,
        Permanent: true,
      }).promise();

    } catch (error: any) {
      if (error.code === 'UsernameExistsException') {
        console.log('User already exists');
      } else {
        throw error;
      }
    }
  };

  const userCredentials = await getTestUserCredentials(configuration, TestUserType.USER);
  const adminCredentials = await getTestUserCredentials(configuration, TestUserType.ADMIN);
  await createUser({
    username: userCredentials.username,
    password: userCredentials.password,
    givenName: 'Tester',
    familyName: 'User',
  });
  await createUser({
    username: adminCredentials.username,
    password: adminCredentials.password,
    givenName: 'Tester',
    familyName: 'Admin',
  });

  console.log(`Adding user ${adminCredentials.username} to Admin group`);
  await cognito.adminAddUserToGroup({
    UserPoolId: configuration.cognitoUserPool,
    Username: adminCredentials.username,
    GroupName: 'Admin',
  }).promise();
}

/**
 * Retrieve the test user credentials from SecretManager.
 * Assume the 'testingRoleArn' if needed.
 * @param configuration Tests configuration.
 */
export async function getTestUserCredentials(configuration: ConfigParameters, userType: TestUserType) {
  const secretManagerConfiguration: AWS.SecretsManager.ClientConfiguration = {
    region: configuration.region,
  };

  if (configuration.testingRoleArn) {
    secretManagerConfiguration.credentials = getTestingRoleCredentials(configuration.testingRoleArn);
  }

  const secretManager = new AWS.SecretsManager(secretManagerConfiguration);

  const userSecretString = (await secretManager.getSecretValue({
    SecretId: userType === TestUserType.ADMIN ? configuration.testAdminSecretArn : configuration.testUserSecretArn,
  }).promise()).SecretString as string;

  const { username, password } = JSON.parse(userSecretString);
  return { username, password };
}

export function getTestingRoleCredentials(testingRoleArn: string) {
  return new AWS.ChainableTemporaryCredentials({
    params: {
      RoleArn: testingRoleArn,
      RoleSessionName: 'FunctionalTests',
    },
  });
}

export function createUsersScript() {
  const { configuration } = Config.loadConfigFromEnv();
  createTestUsers(configuration)
    .catch((error) => console.error(error));
}
