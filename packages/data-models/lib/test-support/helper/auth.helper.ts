import AWS from 'aws-sdk';

export function getTestingRoleCredentials(testingRoleArn: string) {
  return new AWS.ChainableTemporaryCredentials({
    params: {
      RoleArn: testingRoleArn,
      RoleSessionName: 'FunctionalTests',
    },
  });
}
