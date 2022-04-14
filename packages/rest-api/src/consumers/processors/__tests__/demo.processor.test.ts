import DemoRecordProcessor from '../demo.processor';
import {Demo, DEMO_TEMPLATE, DemoModel, DemoStatus} from 'data-models';

const DEMO: Demo = {
  ...DEMO_TEMPLATE,
  id: '00000000-0000-0000-0000-000000000000',
  entityId: 'v0_00000000-0000-0000-0000-000000000000',
  version: 3,
  createdDate: '2020-11-17T00:00:00.000Z',
  updatedDate: '2020-11-17T00:00:00.000Z',
};

describe('DemoRecordProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global.console, 'error').mockImplementation(() => {}); // eslint-disable-line
  });

  describe('process', () => {
    const processor = new DemoRecordProcessor();

    it('No action should be done', async () => {
      const results = await processor.process({
        eventName: 'REMOVE',
        oldImage: DemoModel.itemize(DEMO),
      });

      expect(results.notifications).toHaveLength(0);
    });
  });
});