import { DocumentClient, ClientConfiguration } from 'aws-sdk/clients/dynamodb';

import { Config } from './config/config';
import { getTestingRoleCredentials } from './auth/auth.helper';


/**
 * DynamoDB Document client to be used by data models.
 */
export const newDocumentClient = function(configuration = Config.loadConfigFromEnv().configuration) {
  const dynamoClientConfig: ClientConfiguration = { region: configuration.region };

  if (configuration.testingRoleArn) {
    dynamoClientConfig.credentials = getTestingRoleCredentials(configuration.testingRoleArn);
  }

  return new DocumentClient(dynamoClientConfig);
};
