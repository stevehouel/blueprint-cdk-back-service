import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

import { CognitoGateway } from '../cognito.gateway';

describe('Cognito Gateway', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAttributes', () => {
    const userAttributes = {
      Username: 'shouel',
      UserAttributes: [
        {
          Name: 'sub',
          Value: 'dd1207ec-9c85-454c-93ba-0972b3c27841',
        },
        {
          Name: 'identities',
          Value: '[{"userId":"shouel","issuer":null,"primary":true,"dateCreated":1605089094354}]',
        },
        {
          Name: 'email_verified',
          Value: 'false',
        },
        {
          Name: 'email',
          Value: 'shouel@test.fr',
        },
      ],
      UserCreateDate: new Date('2022-03-03T10:04:54.360Z'),
      UserLastModifiedDate: new Date('2022-03-03T10:04:54.360Z'),
      Enabled: true,
      UserStatus: 'EXTERNAL_PROVIDER',
    };

    const expectedResponse = {
      sub: 'dd1207ec-9c85-454c-93ba-0972b3c27841',
      identities: '[{"userId":"shouel","issuer":null,"primary":true,"dateCreated":1605089094354}]',
      email_verified: 'false',
      email: 'shouel@test.fr',
      username: 'shouel',
    };

    it('should be invoked with params', async () => {
      const provider = new CognitoIdentityProviderClient({});
      jest.spyOn(provider, 'send').mockImplementation(() => Promise.resolve(userAttributes));
      const cognito = new CognitoGateway('test-user-pool-id', provider);
      await cognito.getAttributes('shouel');
      const response = await cognito.getAttributes('shouel');
      expect(response).toEqual(expectedResponse);
    });
  });

});
