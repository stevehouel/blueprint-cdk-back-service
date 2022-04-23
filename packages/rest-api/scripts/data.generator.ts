import {
  BadRequestError, Config,
  Demo, DemoStatus
} from 'data-models';
import {getDataModelsFromConfig} from './data.tools';
export const { configuration } = Config.loadConfigFromEnv();

const demos: Demo[] = [
  {
    id: 'f0d738a6-bb0e-494a-9830-a3d88a3f159b',
    entityId: 'v0_f0d738a6-bb0e-494a-9830-a3d88a3f159b',
    version: 2,
    userId: 'testuser',
    createdDate: '2021-05-10T00:00:00.000Z',
    updatedDate: '2021-05-10T00:00:00.000Z',
    demoStatus: DemoStatus.Validated,
  },
  {
    id: 'f0d738a6-bb0e-494a-9830-a3d88a3f159b',
    entityId: 'v2_f0d738a6-bb0e-494a-9830-a3d88a3f159b',
    version: 2,
    userId: 'testuser',
    createdDate: '2021-05-10T00:00:00.000Z',
    updatedDate: '2021-05-10T00:00:00.000Z',
    demoStatus: DemoStatus.Created,
  }
];

function handleError(error: Error) {
  if (error instanceof BadRequestError) {
    console.warn(error.message);
  } else {
    console.error(error);
  }
}

export async function generateDevelopmentData() {
  const {
    demoModel,
  } = await getDataModelsFromConfig(configuration);

  await Promise.all(demos.map(demo => demoModel.create(demo).catch((e: any) => handleError(e))));
}
