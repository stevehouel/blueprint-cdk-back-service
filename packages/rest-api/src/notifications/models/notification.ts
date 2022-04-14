export enum RecipientType {
  User = 'User',
  MailingList = 'MailingList',
}

export interface UserRecipient {
  userId: string;
  type: RecipientType.User,
}

export interface MailingListRecipient {
  email: string;
  type: RecipientType.MailingList,
}

export interface NotificationIntent {
  recipient: UserRecipient | MailingListRecipient;
  subject: string;
  content: string;
  action?: string;
}