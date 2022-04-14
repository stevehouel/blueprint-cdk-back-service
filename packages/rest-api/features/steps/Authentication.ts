import { configuration, dataManager } from './Shared';
import {Given} from '@cucumber/cucumber';
import {getCognitoUserTokens, TestUserType} from 'data-models';

const userTokenPromise = getCognitoUserTokens(configuration, TestUserType.USER);
const adminTokenPromise = getCognitoUserTokens(configuration, TestUserType.ADMIN);

Given('I am authenticated', async function() {
  const tokens = await userTokenPromise;
  this.accessToken = tokens.accessToken;
  dataManager.setMyUserId(decodeTokenPayload(tokens.idToken)['cognito:username']);
});

Given('I am user with Admin role', async function() {
  const tokens = await adminTokenPromise;
  this.accessToken = tokens.accessToken;
  dataManager.setMyUserId(decodeTokenPayload(tokens.idToken)['cognito:username']);
});

Given('I am user without Admin role', async function() {
  const tokens = await userTokenPromise;
  this.accessToken = tokens.accessToken;
  dataManager.setMyUserId(decodeTokenPayload(tokens.idToken)['cognito:username']);
});

/**
 * Decode a JWT token payload. WARNING: doesn't verify token.
 * @param token JWT token.
 * @return Token payload.
 */
function decodeTokenPayload(token: string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
}
