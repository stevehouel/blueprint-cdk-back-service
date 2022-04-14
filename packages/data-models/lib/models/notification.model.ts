
export enum NotificationType {
  INSTANT_MESSAGE = 'INSTANT_MESSAGE',
}

export interface Message {
  /** Destination email */
  email: string;
  /** Subject */
  subject: string;
  /** Content */
  content: string;
  /** Action */
  action?: string;
}

export interface InstantMessageNotification {
  type: NotificationType.INSTANT_MESSAGE;
  /** Message */
  message: Message;
}

export type Notification = InstantMessageNotification;
