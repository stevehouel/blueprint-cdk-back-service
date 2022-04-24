import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { v4 as uuid } from 'uuid';

import { BadRequestError, NotFoundError } from '../errors';
import { Demo, DemoModel, DemoStatus } from '../demo.model';

jest.mock('uuid');
const uuidMock = uuid as jest.MockedFunction<typeof uuid>;
const originalDateToISO = global.Date.prototype.toISOString;

describe('DemoModel', () => {
  it('should create a new model instance', () => {
    const demoModel = new DemoModel('Demo');
    expect(demoModel).toHaveProperty('client');
    expect(demoModel).toHaveProperty('table');
  });

  describe('static methods', () => {
    it('getEntityId should return the latest entity id', () => {
      expect(DemoModel.getEntityId(DEMO_ID))
        .toBe('v0_' + DEMO_ID);
    });

    it('getEntityId should return the v22 entity id', () => {
      expect(DemoModel.getEntityId(DEMO_ID, 22))
        .toBe('v22_' + DEMO_ID);
    });

    it('getEntityId should work with an empty id', () => {
      expect(DemoModel.getEntityId(''))
        .toBe('v0_');
    });
  });

  describe('methods', () => {
    const mockClient = {
      get: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),
      transactWrite: jest.fn(),
    };

    let demoModel: DemoModel;

    beforeEach(() => {
      jest.clearAllMocks();
      demoModel = new DemoModel('Demo', mockClient as unknown as DocumentClient);
      demoModel.validate = jest.fn();
      uuidMock.mockReturnValue(DEMO_ID);
      global.Date.prototype.toISOString = jest.fn().mockReturnValue(new Date().toISOString());
    });

    afterEach(() => {
      global.Date.prototype.toISOString = originalDateToISO;
    });

    it('should create an demo', () => {
      mockClient.transactWrite.mockReturnValue({ promise: () => Promise.resolve() });
      console.log(demoData);

      const expectedResult = {
        ...demoData,
        version: 1,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };

      return demoModel.create(demoData)
        .then((resp) => {
          expect(resp).toEqual(expectedResult);
          expect(uuidMock).toHaveBeenCalled();
          expect(demoModel.validate).toHaveBeenCalled();
          expect(mockClient.transactWrite).toHaveBeenCalledWith({
            TransactItems: expect.arrayContaining([
              {
                Put: expect.objectContaining({
                  Item: expect.objectContaining({ entityId: DemoModel.getEntityId(DEMO_ID) }),
                }),
              },
              {
                Put: expect.objectContaining({
                  Item: expect.objectContaining({ entityId: DemoModel.getEntityId(DEMO_ID, 1) }),
                }),
              },
            ]),
          });
        });
    });

    it('create should throw on invalid demo', () => {
      demoModel.validate = jest.fn().mockImplementation(() => { throw new BadRequestError('invalid' ); });

      return expect(demoModel.create(demoData))
        .rejects.toThrowError(BadRequestError);
    });

    it('create should retry on id collision', () => {
      mockClient.transactWrite
        .mockReturnValueOnce({ promise: () => Promise.reject({ code: 'TransactionCanceledException', message: 'ConditionalCheckFailed' }) })
        .mockReturnValue({ promise: () => Promise.resolve() });

      const expectedResult = {
        ...demoData,
        version: 1,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };

      return demoModel.create(demoData, 1)
        .then((resp) => {
          expect(resp).toEqual(expectedResult);
          expect(mockClient.transactWrite).toHaveBeenCalledTimes(2);
        });
    });

    it('create should throw on id collision without retry', () => {
      mockClient.transactWrite.mockReturnValueOnce({ promise: () => Promise.reject({ code: 'TransactionCanceledException', message: 'ConditionalCheckFailed' }) });

      return expect(demoModel.create(demoData, 0))
        .rejects.toBeTruthy();
    });

    it('should update a demo', () => {
      const expectedDate = '2020-12-12T12:12:12.122Z';
      mockClient.transactWrite.mockReturnValue({ promise: () => Promise.resolve() });
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({
        Item: {
          ...demoData,
          version: 21,
          updatedDate: '2020-01-01T01:01:01.001Z',
        },
      }) });
      global.Date.prototype.toISOString = jest.fn().mockReturnValue(expectedDate);

      const expectedResult = {
        ...demoData,
        entityId: DemoModel.getEntityId(DEMO_ID),
        version: 22,
        updatedDate: expectedDate,
      };

      return demoModel.update(demoData)
        .then((resp) => {
          expect(resp).toEqual(expectedResult);
          expect(demoModel.validate).toHaveBeenCalled();
          expect(mockClient.get).toHaveBeenCalled();
          expect(mockClient.transactWrite).toHaveBeenCalledWith({
            TransactItems: expect.arrayContaining([
              {
                Put: expect.objectContaining({
                  Item: expect.objectContaining({ entityId: DemoModel.getEntityId(DEMO_ID) }),
                }),
              },
              {
                Put: expect.objectContaining({
                  Item: expect.objectContaining({ entityId: DemoModel.getEntityId(DEMO_ID, 22) }),
                }),
              },
            ]),
          });
        });
    });


    it('should update a demo status', () => {
      const expectedDate = '2020-12-12T12:12:12.122Z';
      mockClient.transactWrite.mockReturnValue({ promise: () => Promise.resolve() });
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({
        Item: {
          ...demoData,
          updatedDate: '2020-01-01T01:01:01.001Z',
          demoStatus: DemoStatus.Created,
        },
      }) });
      global.Date.prototype.toISOString = jest.fn().mockReturnValue(expectedDate);

      const expectedResult = {
        ...demoData,
        entityId: DemoModel.getEntityId(DEMO_ID),
        updatedDate: expectedDate,
        demoStatus: DemoStatus.Validated,
      };

      return demoModel.updateRevision({
        ...demoData,
        demoStatus: DemoStatus.Validated,
      })
        .then((resp) => {
          expect(resp).toEqual(expectedResult);
          expect(demoModel.validate).toHaveBeenCalled();
          expect(mockClient.get).toHaveBeenCalled();
          expect(mockClient.transactWrite).toHaveBeenCalledWith({
            TransactItems: expect.arrayContaining([
              {
                Put: expect.objectContaining({
                  Item: expect.objectContaining({ entityId: DemoModel.getEntityId(DEMO_ID) }),
                }),
              },
              {
                Put: expect.objectContaining({
                  Item: expect.objectContaining({ entityId: DemoModel.getEntityId(DEMO_ID, 1) }),
                }),
              },
            ]),
          });
        });
    });

    it('update should throw on invalid demo', () => {
      demoModel.validate = jest.fn().mockImplementation(() => { throw new BadRequestError('invalid' ); });

      return expect(demoModel.update(demoData))
        .rejects.toThrowError(BadRequestError);
    });

    it('update status should throw on invalid demo', () => {
      demoModel.validate = jest.fn().mockImplementation(() => { throw new BadRequestError('invalid' ); });

      return expect(demoModel.updateRevision(demoData))
        .rejects.toThrowError(BadRequestError);
    });

    it("update should throw if the demo doesn't exists", () => {
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({ Item: undefined }) });

      return expect(demoModel.update(demoData))
        .rejects.toThrowError(NotFoundError);
    });

    it("update status should throw if the demo doesn't exists", () => {
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({ Item: undefined }) });

      return expect(demoModel.updateRevision(demoData))
        .rejects.toThrowError(NotFoundError);
    });

    it('should get the latest version of the demo', () => {
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({ Item: demoData }) });

      return demoModel.get(DEMO_ID)
        .then((resp) => {
          expect(resp).toEqual(demoData);
          expect(mockClient.get).toHaveBeenCalledWith(expect.objectContaining({ Key: {
            entityId: DemoModel.getEntityId(DEMO_ID),
          }}));
        });
    });

    it('should get the version 22 of the demo', () => {
      const demoDatav22 = {
        ...demoData,
        version: 22,
        entityId: DemoModel.getEntityId(DEMO_ID, 22),
      };
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({ Item: demoDatav22 }) });

      return demoModel.get(DEMO_ID, 22)
        .then((resp) => {
          expect(resp).toEqual(demoDatav22);
          expect(mockClient.get).toHaveBeenCalledWith(expect.objectContaining({ Key: {
            entityId: DemoModel.getEntityId(DEMO_ID, 22),
          }}));
        });
    });

    it("get should throw if the demo doesn't exists", () => {
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({ Item: undefined }) });

      return expect(demoModel.get('not-exists'))
        .rejects.toThrowError(NotFoundError);
    });

    it('should get all demo for a user', () => {
      mockClient.query.mockReturnValue({ promise: () => Promise.resolve({ Items: [ demoData ]}) });

      return demoModel.getAll('shouel')
        .then((resp) => {
          expect(resp).toEqual([ demoData ]);
          expect(mockClient.query).toHaveBeenCalledWith(expect.objectContaining({
            KeyConditionExpression: 'userId = :userId and begins_with(entityId, :latest)',
            ExpressionAttributeValues: {
              ':userId': 'shouel',
              ':latest': DemoModel.getEntityId('', 0),
            },
          }));
        });
    });

    it('should get an empty demo list for a user', () => {
      mockClient.query.mockReturnValue({ promise: () => Promise.resolve({}) });

      return expect(demoModel.getAll('empty'))
        .resolves.toEqual([]);
    });

    it('should get all demo versions for a given id', () => {
      mockClient.query.mockReturnValue({ promise: () => Promise.resolve({ Items: [ demoData ]}) });

      return demoModel.getAllById(DEMO_ID)
        .then((resp) => {
          expect(resp).toEqual([ demoData ]);
          expect(mockClient.query).toHaveBeenCalledWith(expect.objectContaining({
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: {
              ':id': DEMO_ID,
            },
          }));
        });
    });

    it('should delete an existing demo', () => {
      mockClient.delete.mockReturnValue({ promise: () => Promise.resolve() });

      return demoModel.delete( 'sample-id')
        .then(() => {
          expect(mockClient.delete).toBeCalled();
        });
    });

    it('should delete all versions of a demo', () => {
      const demoDatav2 = {
        ...demoData,
        version: 2,
        entityId: DemoModel.getEntityId(DEMO_ID, 2),
      };
      mockClient.get.mockReturnValue({ promise: () => Promise.resolve({ Item: demoDatav2 }) });
      mockClient.delete.mockReturnValue({ promise: () => Promise.resolve() });

      return demoModel.deleteCompletely( 'sample-id')
        .then(() => {
          expect(mockClient.get).toBeCalled();
          expect(mockClient.delete).toBeCalledTimes(3);
        });
    });

    it('should throw when deleting a non-existing demo', () => {
      mockClient.delete.mockReturnValue({
        promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' }),
      });

      return expect(demoModel.delete('sample-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('validate', () => {
    const demoModel = new DemoModel('Demo');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should validate a valid demo', () => {
      expect(demoModel.validate(demoData)).toEqual(demoData);
    });

    it('should throw with invalid demo', () => {
      expect(() => demoModel.validate({
        ...demoData,
        repository: 'test',
      } as unknown as Demo)).toThrow();
    });

    it('should throw with empty demo', () => {
      expect(() => demoModel.validate({} as unknown as Demo)).toThrow();
    } );
  });
});

const DEMO_ID = '3f75a14c-7066-4fa7-a4ce-d689979074c3';

const demoData: Demo = {
  id: DEMO_ID,
  entityId: DemoModel.getEntityId(DEMO_ID),
  version: 1,
  userId: 'shouel',
  createdDate: '2021-05-06T10:43:06.325Z',
  updatedDate: '2021-05-06T10:43:06.325Z',
  demoStatus: 'CREATED' as DemoStatus
};

