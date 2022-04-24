import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import { BadRequestError, NotFoundError } from './errors';
import DemoSchema from '../schemas/demo.schema.json';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { GenericModel } from './generic.model';

const ID_INDEX = 'IdIndex';
const USER_STATUS_INDEX = 'UserStatusIndex';
const USER_INDEX = 'UserIndex';

const ajv = new Ajv();
addFormats(ajv);

export enum DemoStatus {
  Created = 'CREATED',
  PendingValidation = 'PENDING_VALIDATION',
  Validated = 'VALIDATED',
  Deleted = 'DELETED',
}

export interface Demo {
  /** Demo id */
  id: string;
  /** Demo entity id with versioning. */
  entityId: string;
  /** Version number, handled by the model. */
  version: number;
  /** Author id */
  userId: string;
  /** Creation date */
  createdDate: string;
  /** Last date when demo was updated */
  updatedDate: string;
  /** Demo Status - WARNING: do not use status name as it's a restricted attribute for DynamoDB */
  demoStatus: DemoStatus;
}

// Internal representation of an demo in DynamoDB
export interface DemoItem extends Demo {
  /** Compound key containing user ID and Status, e.g., shouel#CREATED */
  userStatusKey: string;
}

/**
 * Model to interact with demo objects.
 */
export class DemoModel extends GenericModel<DemoItem> {
  /** JSON schema validate function */
  private validateSchema: ValidateFunction;

  /**
   * DemoModel constructor.
   * @param table Demo table name.
   * @param client DynamoDB client, if undefined it will be created in the constructor.
   */
  constructor(table: string, client = new DocumentClient()) {
    super(table, client);
    this.validateSchema = ajv.compile(DemoSchema);
  }

  /**
   * Get a versioned id to be stored in database.
   * @param resourceId Demo resource id.
   * @param version Version, 0 = latest.
   * @returns A formated demo entity id with version.
   */
  static getEntityId(id: string, version = 0) {
    return `v${version}_${id}`;
  }

  /**
   * Retrieve a single demo if it exists.
   * @param id Demo id.
   * @param version Demo version, default to the latest.
   * @returns The existing Demo.
   */
  get(id: string, version = 0): Promise<Demo> {
    return this.getByEntityId(DemoModel.getEntityId(id, version));
  }

  /**
   * Retrieve a single demo if it exists.
   * @param id Demo id including version.
   * @returns The existing Demo.
   */
  getByEntityId(entityId: string): Promise<Demo> {
    return this.client.get({
      TableName: this.table,
      Key: {
        entityId: entityId,
      },
    }).promise()
      .then((resp) => {
        if (!resp.Item) {
          throw new NotFoundError(`Demo with entity id '${entityId}'`);
        }
        return DemoModel.deItemize(resp.Item as DemoItem);
      });
  }

  /**
   * Generate query to be sent to DynamoDB.
   * @param key Key to be used in expression.
   * @param value Value to be used in expression.
   * @param index Index to be used for query.
   */
  generateGetQuery(key: string, value: string, index: string) {
    return {
      TableName: this.table,
      IndexName: index,
      KeyConditionExpression: `${key} = :${key} and begins_with(entityId, :latest)`,
      ExpressionAttributeValues: {
        [`:${key}`]: value,
        ':latest': DemoModel.getEntityId('', 0),
      },
      ScanIndexForward: false,
    };
  }

  /**
   * Handle pagination of DynamoDB query responses in the backend.
   * @param params Valid parameters for DocumentClient's `query` method.
   * @returns List of demos.
   */
  private async query(params: DocumentClient.QueryInput) {
    const responseItems = await this.queryWithPagination(params);
    return responseItems.map(item => DemoModel.deItemize(item));
  }

  /**
   * Handle pagination of DynamoDB scan responses in the backend.
   * @param params Valid parameters for DocumentClient's `scan` method.
   * @returns List of demos.
   */
  private async scan(params: DocumentClient.ScanInput) {
    const responseItems = await this.scanWithPagination(params);
    return responseItems.map(item => DemoModel.deItemize(item));
  }

  /**
   * List all demos.
   * @returns All of the existing demo.
   */
  getAll(userId?: string, demoStatus?: DemoStatus): Promise<Demo[]> {
    // Get demos by userId and status
    if (userId && demoStatus) {
      return this.client.query(
        this.generateGetQuery('userStatusKey', `${userId}#${demoStatus}`, USER_STATUS_INDEX),
      ).promise()
        .then((resp) => (resp.Items?.map((item) => DemoModel.deItemize(item as DemoItem)) || []) as Demo[]);
    }

    if(userId) {
      return this.client.query(
        this.generateGetQuery('userId', userId, USER_INDEX),
      ).promise()
        .then((resp) => (resp.Items?.map((item) => DemoModel.deItemize(item as DemoItem)) || []) as Demo[]);
    }

    // Get all demos
    return this.client.scan({
      TableName: this.table,
    }).promise()
      .then((resp) => (resp.Items?.map((item) => DemoModel.deItemize(item as DemoItem)) || []) as Demo[]);
  }

  /**
   * List all demos chronology based on its id.
   * @returns All of the existing demo.
   */
  getAllById(id: string): Promise<Demo[]> {
    return this.client.query({
      TableName: this.table,
      IndexName: ID_INDEX,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        [':id']: id,
      },
      ScanIndexForward: false,
    },
    ).promise()
      .then((resp) => (resp.Items?.map((item) => DemoModel.deItemize(item as DemoItem)) || []) as Demo[]);
  }

  /**
   * Create a new demo. Check that the input is valid. Generate a uuid id.
   * Retry on uuid collision.
   * @param demoInput Demo input that will be validated.
   * @param retry Number of remaining retry in case of uuid collision.
   * @returns The created demo.
   */
  async create(demoInput: Partial<Demo>, retry = 2): Promise<Demo> {
    const currentDate = new Date().toISOString();
    const id = uuidv4();
    const demo = {
      ...demoInput,
      id,
      entityId: DemoModel.getEntityId(id),
      version: 1,
      createdDate: currentDate,
      updatedDate: currentDate,
      demoStatus: DemoStatus.Created,
    } as Demo;

    this.validate(demo);

    try {
      await this.save(demo);
      return demo;
    } catch (err: any) {
      if (err.code === 'TransactionCanceledException' && err.message.includes('ConditionalCheckFailed') && retry > 0) {
        console.log(`Demo with id '${demo.id}' already exists. Re-trying with a different id.`);
        return this.create(demoInput, retry - 1);
      } else {
        throw err;
      }
    }
  }

  /**
   * Update an existing demo. Check that the input is valid and the object already exists.
   * @param demoInput Demo input that will be validated.
   * @returns The updated demo.
   */
  async update(demo: Demo): Promise<Demo> {
    const { id } = demo;
    const latest = await this.get(id);
    const updatedDemo = {
      ...demo,
      entityId: DemoModel.getEntityId(id),
      version: latest.version + 1,
      updatedDate: new Date().toISOString(),
    };

    this.validate(updatedDemo);

    try {
      await this.save(updatedDemo);
      return updatedDemo;
    } catch (err: any) {
      if (err.code === 'TransactionCanceledException' && err.message.includes('ConditionalCheckFailed')) {
        throw new BadRequestError(`Demo with id '${demo.id}' and version '${demo.version}' already exists.`);
      } else {
        throw err;
      }
    }
  }

  /**
   * Update an existing demo without creating a new version. Check that the input is valid and the object already exists.
   * @param demoInput Demo input that will be validated.
   * @returns The updated demo.
   */
  async updateRevision(demo: Demo): Promise<Demo> {
    const { id } = demo;
    const latest = await this.get(id);
    const updatedDemo = {
      ...latest,
      entityId: DemoModel.getEntityId(id),
      updatedDate: new Date().toISOString(),
      demoStatus: demo.demoStatus,
    };

    this.validate(updatedDemo);

    try {
      await this.client.transactWrite({
        TransactItems: [
          {
            // Store the demo at the latest version.
            Put: {
              TableName: this.table,
              Item: {
                ...DemoModel.itemize(updatedDemo),
                entityId: DemoModel.getEntityId(demo.id),
              },
            },
          },
          {
            // Store the demo at the specified version.
            Put: {
              TableName: this.table,
              Item: {
                ...DemoModel.itemize(updatedDemo),
                entityId: DemoModel.getEntityId(demo.id, demo.version),
              },
              ConditionExpression: 'attribute_exists(entityId)',
            },
          },
        ],
      }).promise();
      return updatedDemo;
    } catch (err: any) {
      if (err.code === 'TransactionCanceledException' && err.message.includes('ConditionalCheckFailed')) {
        throw new BadRequestError(`Demo with id '${demo.id}' and version '${demo.version}' does not exist.`);
      } else {
        throw err;
      }
    }
  }

  /**
   * Delete an existing demo.
   * @param id Demo identifier.
   * @param version Demo specific version.
   */
  delete(id: string, version = 0) {
    return this.client.delete({
      TableName: this.table,
      Key: { entityId: DemoModel.getEntityId(id, version) },
      ConditionExpression: 'attribute_exists(entityId)',
    }).promise()
      .catch((err) => {
        if (err.code === 'ConditionalCheckFailedException') {
          throw new NotFoundError(`Demo with id '${id}' and version ${version}`);
        } else {
          throw err;
        }
      });
  }

  /**
   * Delete all versions of an existing demo.
   * @param entityId Demo identifier.
   */
  async deleteCompletely(id: string) {
    const latest = await this.get(id);
    for (let _i = 0; _i <= latest.version; _i++) {
      await this.delete(id, _i);
    }
  }

  /**
   * Save a demo to the database. Store the current/latest version twice:
   *  * using the entityId prefix `v0_`
   *  * using the entityId prefix `v{version}_`
   * @param demo The demo to store.
   */
  private async save(demo: Demo) {
    await this.client.transactWrite({
      TransactItems: [
        {
          // Store the demo at the latest version.
          Put: {
            TableName: this.table,
            Item: {
              ...DemoModel.itemize(demo),
              entityId: DemoModel.getEntityId(demo.id),
            },
          },
        },
        {
          // Store the demo at the specified version.
          Put: {
            TableName: this.table,
            Item: {
              ...DemoModel.itemize(demo),
              entityId: DemoModel.getEntityId(demo.id, demo.version),
            },
            ConditionExpression: 'attribute_not_exists(entityId)',
          },
        },
      ],
    }).promise();
  }



  /**
   * Convert an Demo object into its DynamoDB item representation.
   * @param demo Demo object
   * @returns DemoItem representation.
   */
  static itemize(demo: Demo): DemoItem {
    return {
      ...demo,
      userStatusKey: `${demo.userId}#${demo.demoStatus}`,
    };
  }

  /**
   * Get an Demo object from its DynamoDB item representation
   * @param item DynamoDB item representation.
   * @returns Demo object.
   */
  static deItemize(item: DemoItem): Demo {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userStatusKey, ...demo } = item;
    return demo;
  }

  /**
   * Validate the demo object.
   * @param demo The demo object to be validated.
   * @returns The validated demo object.
   */
  validate(demo: Demo): Demo {
    if (this.validateSchema(demo)) {
      return demo;
    } else {
      throw new BadRequestError(this.validateSchema.errors && this.validateSchema.errors[0].message || 'Validation error');
    }
  }

  /**
   * Parse a string body to an Demo object with JSON schema validation.
   * @param body String containing a Demo object.
   * @throws {BadRequestError} on parsing and validation error.
   */
  parse(body: string): Demo {
    let demo;
    try {
      demo = JSON.parse(body);
    } catch {
      throw new BadRequestError('Invalid JSON');
    }
    return demo;
  }

}
