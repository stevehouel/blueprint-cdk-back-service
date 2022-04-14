import { BadRequestError } from './errors';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import FeedbackSchema from '../schemas/feedback.schema.json';
import SQS from 'aws-sdk/clients/sqs';

const ajv = new Ajv();
addFormats(ajv);

export interface Feedback {
  /** Feedback sender */
  userId: string;
  /** Feedback message */
  message?: string;
  /** Rating 1 to 5 */
  rating: number;
  /** Feedback creation time */
  timestamp: string;
}

export type FeedbackInput = Pick<Feedback, 'message' | 'rating'>;

/**
 * Model to parse and store feedback objects
 */
export class FeedbackModel {
  /** JSON schema validate function */
  private validateSchema: ValidateFunction;
  /** SQS Client */
  private client: SQS;
  /** SQS Queue URL */
  private queueURL: string;

  /**
   * Feedback constructor.
   * @param queueURL SQS Queue URL.
   * @param client SQS client, if undefined it will be created in the constructor.
   */
  constructor(queueURL = '', client: SQS = new SQS({})) {
    this.client = client;
    this.queueURL = queueURL;
    this.validateSchema = ajv.compile(FeedbackSchema);
  }

  /**
   * Send a feedback to a sqs queue
   * @param feedback the feedback to send in the sqs queue
   */
  async send(feedback: Feedback): Promise<Feedback> {
    const bytes = JSON.stringify(feedback);
    return this.client.sendMessage({
      QueueUrl: this.queueURL,
      MessageBody: bytes,
    }).promise()
      .then(() => feedback);
  }

  /**
   * Parse a string body to a Feeback object with JSON schema validation.
   * @param body String containing a feedback object.
   * @returns feedback
   * @throws {BadRequestError} on parsing and validation error.
   */
  parse(body: string): FeedbackInput {
    let feedback: FeedbackInput;
    try {
      feedback = JSON.parse(body);
    } catch {
      throw new BadRequestError('Invalid JSON');
    }
    if (this.validateSchema(feedback)) {
      return feedback;
    } else {
      throw new BadRequestError(this.validateSchema.errors && this.validateSchema.errors[0].message || 'Validation error');
    }
  }
}

