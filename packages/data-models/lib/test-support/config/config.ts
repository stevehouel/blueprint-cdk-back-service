import {existsSync, readFileSync} from 'fs';
import { resolve } from 'path';
import {ResourceNotFoundException} from '@aws-sdk/client-cognito-identity-provider';

export interface ConfigParameters {
  region: string;
  cognitoClientId: string;
  cognitoUserPool: string;
  testUserSecretArn: string;
  testAdminSecretArn: string;
  testingRoleArn?: string;
  apiUrl: string;
  demoTable: string;
}

/**
 * Test configuration loader.
 */
export class Config {
  /** The current configuration */
  public readonly configuration: ConfigParameters;

  /**
   * Load the configuration from the directory.
   *
   * @param {string} stage corresponding to the environment stage.
   * @throws {Error} if the stage does not exist in the configuration.
   */
  constructor(stage: string, configFilePath: string) {
    if(existsSync(configFilePath)) {
      // Load config from config file path
      const rawConfig = readFileSync(configFilePath);
      this.configuration = JSON.parse(rawConfig.toString());
    } else if(process.env.REGION
      && process.env.COGNITO_USER_POOL_ID
      && process.env.COGNITO_APP_CLIENT_ID
      && process.env.TEST_USER_SECRET_ARN
      && process.env.TEST_ADMIN_SECRET_ARN
      && process.env.API_URL
      && process.env.DEMO_TABLE_NAME) {
      // Load from env vars
      this.configuration = {
        region: process.env.REGION,
        cognitoClientId: process.env.COGNITO_USER_POOL_ID,
        cognitoUserPool: process.env.COGNITO_APP_CLIENT_ID,
        testUserSecretArn: process.env.TEST_USER_SECRET_ARN,
        testAdminSecretArn: process.env.TEST_ADMIN_SECRET_ARN,
        testingRoleArn: process.env.TESTING_ROLE_ARN,
        apiUrl: process.env.API_URL,
        demoTable: process.env.DEMO_TABLE_NAME,
      }
    } else {
      throw new Error(`No configuration found for stage: ${stage}. Please share configuration through a file or Env variables`);
    }
  }

  /**
   * Create a new instance of Config with what's available in the environment.
   */
  static loadConfigFromEnv() {
    const stage = process.env.STAGE || process.env.USER || 'local';
    const configFilePath = process.env.CONFIG_FILE || resolve('features/config', `config.${stage}.json`);
    return new this(stage, configFilePath);
  }
}
