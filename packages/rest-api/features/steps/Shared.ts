import expect from 'expect';
import { DataManager, Config } from 'data-models';
import {After, setDefaultTimeout, Then} from '@cucumber/cucumber';


export const { configuration } = Config.loadConfigFromEnv();
export const dataManager = new DataManager(configuration);

// Runs after every test case to clean up the resources used.
After(async function () {
  await dataManager.deleteAll();
});

// Set default timeout to 15s.
setDefaultTimeout(15 * 1000);

Then('I get a {int} status', function (expectedStatus) {
  const status = this.response && this.response.status || this.error && this.error.response?.status || -1;
  expect(status).toBe(expectedStatus);
});
