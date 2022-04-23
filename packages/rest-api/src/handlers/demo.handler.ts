import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { DemoModel, DemoStatus, BadRequestError, ForbiddenError } from 'data-models';

import { ApiController } from './api.controller';

const TABLE = process.env.DEMO_TABLE_NAME || 'Demo';

const client = new DocumentClient();
const demoModel = new DemoModel(TABLE, client);

const api = new ApiController();

/**
 * GET /demos
 * Handler to retrieve the demo list.
 */
const getAll = api.handle(async (request) => {
  const id = request.queryStringParameters ? request.queryStringParameters.id : undefined;
  const userId = request.queryStringParameters ? request.queryStringParameters.userId : undefined;
  const demoStatus = request.queryStringParameters ? request.queryStringParameters.demoStatus as DemoStatus : undefined;

  return {
    body: { demos: id ? await demoModel.getAllById(id) : await demoModel.getAll(userId, demoStatus) },
  };
});


/**
 * GET /demos/{id}?version={number}
 * Handler to retrieve a specific demo.
 */
const get = api.handle(async (request) => {
  const id = request.pathParameters.id;
  const version = request.queryStringParameters?.version
    ? Number.parseInt(request.queryStringParameters.version)
    : 0;
  return {
    body: await demoModel.get(id, version),
  };
});


/**
 * POST /demos
 * Handler to create a new demo.
 */
const post = api.handle(async (request) => {
  const demo = await demoModel.create(demoModel.parse(request.body));
  return {
    statusCode: 201,
    body: demo,
    headers: { Location: `${request.rawPath}/${demo.id}` },
  };
});

/**
 * PUT /demos/{id}
 * Handler to update an existing demo.
 * Demo can be updated by the owner and the Demo lead
 */
const put = api.handle(async (request) => {
  const parsedDemo = demoModel.parse(request.body);
  if (request.pathParameters.id !== parsedDemo.id) {
    throw new BadRequestError("Demo ids don't match");
  }
  const currentDemo = await demoModel.get(request.pathParameters.id);
  let updatedDemo;
  console.info(`Create new version of demo ${JSON.stringify(currentDemo)} with new content ${JSON.stringify(parsedDemo)}`);
  updatedDemo = await demoModel.update(parsedDemo);
  return {
    body: updatedDemo,
  };
});

/**
 * DELETE /demos/{id}
 * Handler to delete an existing demo.
 * Only available for the user who created the demo
 */
const deleteDemo = api.handle(async (request) => {
  const demo = await demoModel.get(request.pathParameters.id);
  await demoModel.delete(demo.id);
  return {
    statusCode: 204,
    body: null,
  };
});

export {
  getAll,
  get,
  post,
  put,
  deleteDemo,
};
