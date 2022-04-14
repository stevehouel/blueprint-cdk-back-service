import axios, {AxiosError, AxiosResponse} from 'axios';
import {
  NotificationType,
  Notification,
  InstantMessageNotification,
} from 'data-models';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export class SlackGateway {
  secretsClient: SecretsManagerClient;
  instantMessageWebHookSecret: string;
  instantMessageWebHook: string;

  constructor(secretsClient: SecretsManagerClient, instantMessageWebHookSecret: string) {
    this.secretsClient = secretsClient;
    this.instantMessageWebHookSecret = instantMessageWebHookSecret;
    this.instantMessageWebHook = '';
  }

  /**
   * Get payload based on notification type.
   * @param notification Notification type.
   */
  getPayload(notification: Notification): any {
    switch (notification.type) {
      case NotificationType.INSTANT_MESSAGE: return this.generateInstantMessage(notification);
      default: throw Error('Unsupported notification type');
    }
  }

  /**
   * Get WebHook based on notification type.
   * @param notification Notification type.
   */
  getWebHook(notification: Notification): string {
    switch (notification.type) {
      case NotificationType.INSTANT_MESSAGE: return this.instantMessageWebHook;
      default: throw Error('Unsupported notification type');
    }
  }

  /**
   * Send notification.
   * @param notification Notification to be sent.
   */
  sendNotification = async (notification: Notification) => {
    if (!this.instantMessageWebHook) {
      const command = new GetSecretValueCommand({
        SecretId: this.instantMessageWebHookSecret,
      });
      const output = await this.secretsClient.send(command);
      this.instantMessageWebHook = output.SecretString || '';
    }
    return await axios
      .post(this.getWebHook(notification), this.getPayload(notification))
      .then((response: AxiosResponse) => {
        return response.data;
      })
      .catch((error: AxiosError) => {
        throw new Error(`Slack api error: ${error.response?.data.error || 'unknown error'}`);
      });
  };

  /**
   * Generate instant message payload.
   * @param notification Notification containing the required fields.
   */
  generateInstantMessage = (notification: InstantMessageNotification) => {
    const message = notification.message;
    return {
      recipient: message.email,
      subject: message.subject,
      content: message.content,
      action: message.action,
    };
  };
}
