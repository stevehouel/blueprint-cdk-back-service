import http from 'http';
import * as AWS from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk';
import { EmailGateway } from './email/email.gateway';

import {
  MailingListRecipient,
  NotificationIntent,
  RecipientType,
  UserRecipient
} from './models/notification';
import { SlackGateway } from './slack/slack.gateway';
import { NotificationType } from 'data-models';
import {CognitoGateway} from './cognito/cognito.gateway';
import {CognitoIdentityProviderClient} from '@aws-sdk/client-cognito-identity-provider';
import {SecretsManagerClient} from '@aws-sdk/client-secrets-manager';

AWSXRay.captureHTTPsGlobal(http);

const DOMAIN_NAME = process.env.DOMAIN_NAME || '';
const INSTANT_MESSAGE_WEB_HOOK_SECRET = process.env.INSTANT_MESSAGE_WEB_HOOK_SECRET || 'InstantMessageWebHookSecret';
const USER_POOL_ID = process.env.USER_POOL_ID || '';

const AWSCaptured = AWSXRay.captureAWS(AWS);
const cognito = new CognitoGateway(USER_POOL_ID, new CognitoIdentityProviderClient({}));
const slack = new SlackGateway(new SecretsManagerClient({}), INSTANT_MESSAGE_WEB_HOOK_SECRET);
const email = new EmailGateway(new AWSCaptured.SES(), DOMAIN_NAME);
/**
 * Process known errors.
 * @param error Error to be processed.
 */
const processError = (error: any) => {
  if (error.code === 'MessageRejected' && error.message.startsWith('Email address is not verified')) {
    console.log('SES is in Sandbox mode. Can not send email.');
    console.log(error);
  } else if (error.message.startsWith('Slack api error: invalid_user_email')) {
    console.log('Invalid user email');
    console.log(error);
  } else {
    console.error(error);
    throw error;
  }
};

/**
 * Parse the input, validate it and return the values that are useful.
 * @param record to be processed
 * @returns parsed message.
 */
const parseRecord = (record: any): NotificationIntent => {
  const body = JSON.parse(record.body);
  validateBody(body);
  return {
    recipient: body.recipient,
    subject: body.subject,
    content: body.content,
    action: body.action,
  };
};

/**
 * Validate the record's body.
 * @param body of the record
 */
const validateBody = (body: Record<string, unknown>) => {
  if (!('type' in body && 'userId' in body && 'subject' in body && 'content' in body)) {
    throw new Error(`Record body is not valid: ${body}`);
  }
};

/**
 * Check whether recipient is user or mailing list.
 * @param recipient
 */
const isUserRecipient = (recipient: UserRecipient | MailingListRecipient): recipient is UserRecipient => {
  return recipient.type === RecipientType.User;
};

/**
 * Handler responsible for consuming notification SQS messages.
 * @param event Event to be consumed.
 */
const notify = async (event: any) => {
  console.info(`Handling event: ${JSON.stringify(event)}`);
  const segment = AWSXRay.getSegment() || new AWSXRay.Segment('notify');
  const subsegment = segment.addNewSubsegment('notifySubsegment');

  if (process.env.IGNORE_NOTIFICATIONS) {
    console.log('Ignoring notification, set process.env.IGNORE_NOTIFICATIONS to undefined to reactive notifications.');
  } else {
    for (const record of event.Records) {
      const message = parseRecord(record);
      console.log(`Sending message: ${JSON.stringify(message)}`);

      try {
        const emailRecipient = isUserRecipient(message.recipient)
          ? await cognito.getUserEmail(message.recipient.userId)
          : message.recipient.email;
        if (isUserRecipient(message.recipient) && message.action) {
          await slack.sendNotification({
            type: NotificationType.INSTANT_MESSAGE,
            message: {
              email: emailRecipient,
              subject: message.subject,
              content: message.content,
              action: message.action,
            },
          });
        }
        await email.sendEmail(emailRecipient, message.subject, message.content);
      } catch (error) {
        processError(error);
      }
    }
  }
  subsegment.close();
};

export {
  notify,
};
