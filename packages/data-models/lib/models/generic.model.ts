import DynamoDB from 'aws-sdk/clients/dynamodb';

/**
 * Generic Model to interact with DynamoDB tables.
 */
export class GenericModel<T> {
  /** DynamoDB client */
  protected client: DynamoDB.DocumentClient;
  /** DynamoDB table name */
  protected table: string;

  /**
   * GenericModel constructor.
   * @param table DynamoDB table name.
   * @param client DynamoDB client.
   */
  constructor(table: string, client: DynamoDB.DocumentClient) {
    this.client = client;
    this.table = table;
  }

  /**
   * Handle pagination of DynamoDB query operation.
   * @returns List of objects of type T.
   * @protected
   * @param queryInput Valid input for DocumentClient's `query` operation.
   */
  protected async queryWithPagination(queryInput: DynamoDB.DocumentClient.QueryInput): Promise<T[]> {
    const responseItems: unknown[] = [];
    let response: DynamoDB.DocumentClient.QueryOutput | undefined = undefined;

    do {
      response = await this.client.query({
        ...queryInput,
        ExclusiveStartKey: response ? response.LastEvaluatedKey : undefined,
      }).promise();
      if (response.Items) {
        responseItems.push(...response.Items);
      }
    } while (response.LastEvaluatedKey);

    return responseItems as T[];
  }

  /**
   * Handle pagination of DynamoDB scan operation.
   * @returns List of objects of type T.
   * @protected
   * @param scanInput Valid input for DocumentClient's `scan` operation.
   */
  protected async scanWithPagination(scanInput: DynamoDB.DocumentClient.ScanInput): Promise<T[]> {
    const responseItems: unknown[] = [];
    let response: DynamoDB.DocumentClient.ScanOutput | undefined = undefined;

    do {
      response = await this.client.scan({
        ...scanInput,
        ExclusiveStartKey: response ? response.LastEvaluatedKey : undefined,
      }).promise();
      if (response.Items) {
        responseItems.push(...response.Items);
      }
    } while (response.LastEvaluatedKey);

    return responseItems as T[];
  }
}
