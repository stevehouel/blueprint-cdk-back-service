import { hasPropertyChanged, ModifyRecord, parseRecord, objectsEqual, arraysEqual } from '../consumer.helpers';
import { cloneDeep } from 'lodash';

describe('consumerHelpers', () => {
  describe('parseRecord', () => {
    const EVENT_RECORD =
      {
        eventID: 'd783c3b2118422b3eac833dead1e3e33',
        eventName: 'X',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb',
        awsRegion: 'us-west-2',
        dynamodb: {
          ApproximateCreationDateTime: 1631613479,
          Keys: {
            sk: {
              S: 'TEST#test-67393c39',
            },
            pk: {
              S: 'someone',
            },
          },
          SequenceNumber: '972845300000000003754939394',
          SizeBytes: 591,
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
        eventSourceARN: 'arn:aws:dynamodb:us-west-2:000000000000:table/TABLE/stream/2022-02-22T13:30:19.884',
      };
    const RAW_IMAGE_OLD = {
      pk: {
        S: 'someone',
      },
      sk: {
        S: 'TEST#test-67393c39',
      },
      activitySummary: {
        M: {
          completed: {
            M: {},
          },
        },
      },
      activityDetails: {
        L: [],
      },
      jobLevel: {
        N: '5',
      },
      availableToMentor: {
        BOOL: false,
      },
    };
    const RAW_IMAGE_NEW = {
      pk: {
        S: 'someone',
      },
      sk: {
        S: 'TEST#test-67393c39',
      },
      activitySummary: {
        M: {
          completed: {
            M: {},
          },
        },
      },
      activityDetails: {
        L: [],
      },
      jobLevel: {
        N: '6',
      },
      availableToMentor: {
        BOOL: false,
      },
    };
    const PARSED_IMAGE_OLD = {
      pk: 'someone',
      sk: 'TEST#test-67393c39',
      activitySummary: { completed: {}},
      activityDetails: [],
      jobLevel: 5,
      availableToMentor: false,
    };
    const PARSED_IMAGE_NEW = {
      pk: 'someone',
      sk: 'TEST#test-67393c39',
      activitySummary: { completed: {}},
      activityDetails: [],
      jobLevel: 6,
      availableToMentor: false,
    };

    it('should parse INSERT events', async () => {
      expect(parseRecord({
        ...EVENT_RECORD,
        eventName: 'INSERT',
        dynamodb: {
          ...EVENT_RECORD.dynamodb,
          NewImage: { ...RAW_IMAGE_NEW },
        },
      })).toEqual({
        eventName: 'INSERT',
        newImage: { ...PARSED_IMAGE_NEW },
      });
    });
    it('should parse MODIFY events', async () => {
      expect(parseRecord({
        ...EVENT_RECORD,
        eventName: 'MODIFY',
        dynamodb: {
          ...EVENT_RECORD.dynamodb,
          OldImage: { ...RAW_IMAGE_OLD },
          NewImage: { ...RAW_IMAGE_NEW },
        },
      })).toEqual({
        eventName: 'MODIFY',
        oldImage: { ...PARSED_IMAGE_OLD },
        newImage: { ...PARSED_IMAGE_NEW },
      });
    });
    it('should parse REMOVE events', async () => {
      expect(parseRecord({
        ...EVENT_RECORD,
        eventName: 'REMOVE',
        dynamodb: {
          ...EVENT_RECORD.dynamodb,
          OldImage: { ...RAW_IMAGE_OLD },
        },
      })).toEqual({
        eventName: 'REMOVE',
        oldImage: { ...PARSED_IMAGE_OLD },
      });
    });
    it('should throw if event name is not recognized', async () => {
      expect(() => parseRecord(test)).toThrowError('not a valid DynamoDB stream event name');
    });
  });

  describe('hasPropertyChanged', () => {
    interface Sample {
      a: number;
      b: string;
      c: [];
      d?: Sample;
      e?: number;
    }
    const recordA: ModifyRecord<Sample> = {
      eventName: 'MODIFY',
      oldImage: { a: 1, b: 'hello', c: [], e: 3 },
      newImage: { a: 2, b: 'hello', c: []},
    };
    const recordB: ModifyRecord<Sample> = {
      eventName: 'MODIFY',
      oldImage: { a: 1, b: 'hello', c: [], d: { a: 2, b: 'yes', c: []}},
      newImage: { a: 1, b: 'hi', c: [], d: { a: 2, b: 'yes', c: []}},
    };

    it('should return true if the property has changed', async () => {
      expect(hasPropertyChanged(recordA, 'a')).toStrictEqual(true);
      expect(hasPropertyChanged(recordA, 'e')).toStrictEqual(true);
      expect(hasPropertyChanged(recordB, 'b')).toStrictEqual(true);
    });
    it('should return false if the property has not changed', async () => {
      expect(hasPropertyChanged(recordA, 'b')).toStrictEqual(false);
      expect(hasPropertyChanged(recordA, 'd')).toStrictEqual(false);
      expect(hasPropertyChanged(recordB, 'a')).toStrictEqual(false);
      expect(hasPropertyChanged(recordB, 'e')).toStrictEqual(false);
    });
    it('should throw if property is an array or object', async () => {
      expect(() => hasPropertyChanged(recordA, 'c')).toThrowError('does not support type');
      expect(() => hasPropertyChanged(recordB, 'c')).toThrowError('does not support type');
      expect(() => hasPropertyChanged(recordB, 'd')).toThrowError('does not support type');
    });
  });

  describe('objectsEquals', () => {
    const objectA = {
      key: {
        inner: {
          a: 1,
          b: 2,
        },
      },
    };
    const objectB = {
      ...objectA,
      other: 33,
    };
    expect(objectsEqual({}, {})).toStrictEqual(false);
    expect(objectsEqual({}, undefined)).toStrictEqual(false);
    expect(objectsEqual(undefined, undefined)).toStrictEqual(true);
    expect(objectsEqual(objectA, objectB)).toStrictEqual(false);
    expect(objectsEqual(objectA, cloneDeep(objectA))).toStrictEqual(true);
    expect(objectsEqual(objectB, cloneDeep(objectB))).toStrictEqual(true);
  });

  describe('arraysEquals', () => {
    const objectA = {
      a: 1,
      b: 2,
    };
    const objectB = {
      a: 1,
      b: 2,
    };
    expect(arraysEqual([], [])).toStrictEqual(true);
    expect(arraysEqual([ 1, 2 ], [ 1, 2 ])).toStrictEqual(true);
    expect(arraysEqual([ objectA ], [ objectB ])).toStrictEqual(true);
    expect(arraysEqual([ objectA ], [])).toStrictEqual(false);
  });
});