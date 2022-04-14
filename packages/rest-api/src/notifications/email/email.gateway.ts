/**
 * Class providing functionality to send emails using SES.
 **/
export class EmailGateway {
  ses: any;
  domainName: string;

  /**
   * Create a new EmailGateway.
   *
   * @param ses The Simple Email Service client to send email.
   * @param domainName The Domain Name to send emails from.
   */
  constructor(ses: any, domainName: string) {
    this.ses = ses;
    this.domainName = domainName;
  }

  /**
   * Send an email.
   *
   * @param recipientAddress the email address of the recipient.
   * @param subject the subject/ title of the email.
   * @param body the contents of the email.
   * @returns Promise containing the sent messageId from SES.
   */
  sendEmail(recipientAddress: string, subject: string, body: string) {
    const sender = `<no-reply@mail.${this.domainName}>`;

    // The character encoding for the email.
    const charset = 'UTF-8';

    // Specify the parameters to pass to the API.
    const params = {
      Source: sender,
      Destination: {
        ToAddresses: [
          recipientAddress,
        ],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: charset,
        },
        Body: {
          Html: {
            Data: body,
            Charset: charset,
          },
        },
      },
    };

    return this.ses.sendEmail(params).promise();
  }
}
