
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs/lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { AttributeType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { DynamoTable } from 'project-constructs';

export interface ModelProps extends StackProps {
  readonly testingRoleArn: string;
}

/** CDK Stack containing DemoFactory model. */
export class ModelStack extends Stack {
  /** DynamoDB table containing the Demo models. */
  public readonly demoTable: DynamoTable;

  /** CloudFormation outputs */
  public readonly demoTableArn: CfnOutput;
  public readonly demoTableName: CfnOutput;
  public readonly demoTableStreamArn: CfnOutput;

  constructor(scope: Construct, id: string, props: ModelProps) {
    super(scope, id, props);
    const testingRole = Role.fromRoleArn(this, 'TestingRole_Model', props.testingRoleArn);

    // ** DYNAMODB TABLES **
    this.demoTable = new DynamoTable(this, 'Demo', {
      tableName: 'Demo',
      partitionKey: {
        name: 'entityId',
        type: AttributeType.STRING,
      },
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Grant for testing
    this.demoTable.grantReadWriteData(testingRole);

    // Global Secondary Indexes
    this.demoTable.addGlobalSecondaryIndex({
      indexName: 'IdIndex',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'entityId',
        type: AttributeType.STRING,
      },
    });

    this.demoTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'entityId',
        type: AttributeType.STRING,
      },
    });

    this.demoTable.addGlobalSecondaryIndex({
      indexName: 'UserStatusIndex',
      partitionKey: {
        name: 'userStatusKey',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'entityId',
        type: AttributeType.STRING,
      },
    });

    this.demoTableArn = new CfnOutput(this, 'DemoTableArn', {
      value: this.demoTable.tableArn,
    });
    this.demoTableName = new CfnOutput(this, 'DemoTableName', {
      value: this.demoTable.tableName,
    });
    if(this.demoTable.tableStreamArn) {
      this.demoTableStreamArn = new CfnOutput(this, 'DemoTableStreamArn', {
        value: this.demoTable.tableStreamArn,
      });
    }
  }
}
