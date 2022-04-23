import AWS from 'aws-sdk';
import {DemoModel} from 'data-models';
import {ConfigParameters} from 'data-models/lib/test-support/config/config';

export interface DataModels {
  demoModel: DemoModel;
}

/** Generate data model instances based on the CloudFormation stack outputs. */
export async function getDataModelsFromConfig(config: ConfigParameters): Promise<DataModels> {
  AWS.config.update({
    region: config.region
  });
  return {
    demoModel: new DemoModel(config.demoTable),
  };
}
