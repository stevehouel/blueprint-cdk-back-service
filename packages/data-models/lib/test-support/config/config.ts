import { readFileSync } from 'fs';
import { resolve } from 'path';

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
    try {
      const rawConfig = readFileSync(configFilePath);
      this.configuration = JSON.parse(rawConfig.toString());
    } catch (error) {
      throw new Error(`No configuration found for stage: ${stage}. Create a ${configFilePath} file.`);
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
