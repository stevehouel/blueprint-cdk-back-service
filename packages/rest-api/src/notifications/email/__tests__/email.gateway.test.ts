import { EmailGateway } from '../email.gateway';
import SES, { SendEmailResponse } from 'aws-sdk/clients/ses';
import { AWSError, Request } from 'aws-sdk';

describe('Email Gateway', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should be invoked with params', async () => {
      const sesClient = new SES();
      const infoSpy = jest.spyOn(sesClient, 'sendEmail').mockReturnValue({ promise: () => Promise.resolve('ses-id') } as unknown as Request<SendEmailResponse, AWSError>);
      const ses = new EmailGateway(sesClient, 'test.domain.com');
      await ses.sendEmail('shouel@test.fr', 'test', 'testing ses');
      expect(infoSpy).toBeCalledWith({
        Destination: {
          ToAddresses: [ 'shouel@test.fr' ],
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: 'testing ses',
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: 'test',
          },
        },
        Source: '<no-reply@mail.test.domain.com>',
      });
    });
  });

});
