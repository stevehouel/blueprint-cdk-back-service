import AWS from 'aws-sdk';
import {DemoModel} from 'data-models';

export interface DataModels {
  demoModel: DemoModel;
}

/** Generate data model instances based on the CloudFormation stack outputs. */
export async function getDataModelsFromStack(stackName: string, region: string): Promise<DataModels> {
  AWS.config.update({ region });
  const cloudFormation = new AWS.CloudFormation();
  const stackOutputs = await cloudFormation.describeStacks({ StackName: stackName }).promise()
    .then(resp => {
      if (!resp.Stacks) {
        throw new Error(`No stack found for stackName: ${stackName}`);
      }
      else if (!resp.Stacks[0].Outputs) {
        throw new Error(`No outputs found for stackName: ${stackName}`);
      }
      return resp.Stacks[0].Outputs;
    });

  return {
    demoModel: new DemoModel(getOutputValue(stackOutputs, 'DemoTableName')),
  };
}

/** Extract CloudFormation output value. */
function getOutputValue(outputs: AWS.CloudFormation.Output[], outputKey: string): string {
  const output = outputs.filter(output => output.OutputKey === outputKey);
  if (output.length === 0) {
    throw new Error(`No output found for outputKey: ${outputKey}`);
  } else if (output[0].OutputValue === undefined) {
    throw new Error(`Output value is undefined for outputKey: ${outputKey}`);
  }
  return output[0].OutputValue;
}
