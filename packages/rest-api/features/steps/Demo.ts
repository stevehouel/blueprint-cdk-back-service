import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios';
import expect from 'expect';
import { v4 as uuidv4 } from 'uuid';
import { dataManager, configuration } from './Shared';
import {Demo, DemoModel, NotFoundError, newDocumentClient, DEMO_TEMPLATE, DemoStatus} from 'data-models';
import {Given, IWorld, Then, When} from '@cucumber/cucumber';

const demoModel = new DemoModel(configuration.demoTable, newDocumentClient(configuration));

declare module '@cucumber/cucumber' {
  interface World {
    accessToken?: string;
    demo?: Demo;
    createdDemo?: Partial<Demo>;
    updatedDemo?: Partial<Demo>;
    response?: AxiosResponse;
    error?: AxiosError;
  }
}

function getClient(cucumberWorld: IWorld) {
  const headers: AxiosRequestConfig['headers'] = {};
  if (cucumberWorld.accessToken) {
    headers.Authorization = cucumberWorld.accessToken;
  }
  return axios.create({
    baseURL: `${configuration.apiUrl}/demos`,
    headers,
  });
}

Given('A demo that I created', async function () {
  this.demo = await dataManager.createDemo();
});

Given('A demo doesn\'t exist', async function () {
  this.demo = {
    id: 'doesnt-exists',
  } as Demo;

  try {
    await demoModel.delete(this.demo.id);
  } catch (err) {
    if (!(err instanceof NotFoundError)) {
      throw err;
    }
  }
});
When('I fetch a list of demos', async function () {
  await getClient(this).get('')
    .then((resp) => this.response = resp)
    .catch((err) => this.error = err);
});

When('I fetch a demo', async function () {
  if (!this.demo) {
    throw new Error('this.demo is not initialized.');
  }
  await getClient(this).get(this.demo.id)
    .then((resp) => this.response = resp)
    .catch((err) => this.error = err);
});

When('I delete a demo', async function () {
  console.log(this.demo);
  const client = getClient(this).delete(`/${this.demo?.id}`)
    .then((resp) => this.response = resp)
    .catch((err) => this.error = err);
});

When('I create a demo', async function () {
  this.createdDemo = {
    ...DEMO_TEMPLATE,
  };
  await getClient(this).post('', this.createdDemo)
    .then((resp) => {
      this.response = resp;
      this.demo = resp.data;
      dataManager.manageDemo(resp.data);
    })
    .catch((err) => this.error = err);
});

When('I update a demo', async function () {
  await getClient(this).put(`/${this.demo?.id}`, {
    ...this.demo,
    demoStatus: DemoStatus.Deleted,
  })
    .then((resp) => {
      this.response = resp;
      this.demo = resp.data;
    })
    .catch((err) => this.error = err);
});

When('I update a demo with invalid properties', async function () {
  await getClient(this).put(`/${this.demo?.id}`, {
    ...this.demo,
    benefits: '',
  })
    .then((resp) => {
      this.response = resp;
      this.demo = resp.data;
    })
    .catch((err) => this.error = err);
});

When('I update the nonexistent demo', async function () {
  const demoId = 'non-existent';
  await getClient(this).put(`/${demoId}`, {
    ...DEMO_TEMPLATE,
    id: demoId,
  })
    .then((resp) => {
      this.response = resp;
      this.demo = resp.data;
    })
    .catch((err) => this.error = err);
});

Then('I get a list of demos', function () {
  expect(this.response?.data.demos).toBeInstanceOf(Array);
  const demos = this.response?.data.demos as Demo[];
  expect(demos).toContainEqual(this.demo);
});

Then('I get the demo', function () {
  expect(this.response?.data).toEqual(this.demo);
});

Then('I get the created demo', function () {
  if (!this.createdDemo) {
    throw new Error('this.createdDemo is not initialized.');
  }
  expect(this.response?.data).toEqual(expect.objectContaining(this.createdDemo));
  expect(this.response?.data.id).toBeTruthy();
  expect(this.response?.data.createdDate).toBeTruthy();
  expect(this.response?.data.updatedDate).toBeTruthy();
});

Then('I get the updated demo', function () {
  const responseData = this.response?.data;
  expect(responseData).toEqual({
    ...this.updatedDemo,
    updatedDate: responseData.updatedDate,
    version: 2,
  });
});