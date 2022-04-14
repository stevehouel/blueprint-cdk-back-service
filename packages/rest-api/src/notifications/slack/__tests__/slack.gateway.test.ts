import axios from 'axios';
import { SlackGateway } from '../slack.gateway';
import { NotificationType } from 'data-models';
import {SecretsManagerClient} from '@aws-sdk/client-secrets-manager';

describe('Slack Gateway', () => {
  const instantMessageWebHook = 'instantMessageWebHook';

  const instantMessageSecret = {
    SecretString: instantMessageWebHook,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    const instantMessageParams = [
      instantMessageWebHook,
      {
        recipient: 'shouel@test.fr',
        subject: 'test subject',
        content: 'test content',
        action: 'test action',
      },
    ];


    it('should send instant message', async () => {
      const infoSpy = jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: {}});
      const client = new SecretsManagerClient({});
      jest.spyOn(client, 'send').mockImplementation(() => Promise.resolve(instantMessageSecret));
      const slack = new SlackGateway(client, instantMessageWebHook);
      await slack.sendNotification({
        type: NotificationType.INSTANT_MESSAGE,
        message: {
          email: 'shouel@test.fr',
          subject: 'test subject',
          content: 'test content',
          action: 'test action',
        },
      });
      expect(infoSpy).toBeCalledWith(...instantMessageParams);
    });
  });

});

