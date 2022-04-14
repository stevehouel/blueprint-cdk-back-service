/**
 * Dynamo Table containing project defaults.
 */
import { BillingMode, Table, TableEncryption, TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';


export class DynamoTable extends Table {
  constructor(scope: Construct, id: string, props: TableProps) {
    super(scope, id, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      ...props,
    });
  }
}
