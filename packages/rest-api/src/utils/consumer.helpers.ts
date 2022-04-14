import { Converter } from 'aws-sdk/clients/dynamodb';

/**
 * Interfaces representing the three possibles states of a DynamoDB stream record.
 */
export interface InsertRecord<T> {
  eventName: 'INSERT';
  newImage: T;
}

export interface ModifyRecord<T> {
  eventName: 'MODIFY';
  oldImage: T;
  newImage: T;
}

export interface RemoveRecord<T> {
  eventName: 'REMOVE';
  oldImage: T;
}

export type ParsedRecord<T> = InsertRecord<T> | ModifyRecord<T> | RemoveRecord<T>;

/**
 * Transforms a raw DynamoDB stream record into a ParsedRecord with the correct state.
 * @param record Raw record from the stream event
 * @returns ParsedRecord
 */
export const parseRecord = <T>(record: any): ParsedRecord<T> => {
  switch (record.eventName) {
    case 'INSERT':
      return {
        eventName: 'INSERT',
        newImage: Converter.unmarshall(record.dynamodb.NewImage) as T,
      };
    case 'MODIFY':
      return {
        eventName: 'MODIFY',
        oldImage: Converter.unmarshall(record.dynamodb.OldImage) as T,
        newImage: Converter.unmarshall(record.dynamodb.NewImage) as T,
      };
    case 'REMOVE':
      return {
        eventName: 'REMOVE',
        oldImage: Converter.unmarshall(record.dynamodb.OldImage) as T,
      };
    default:
      throw new Error(`"${record.eventName}" is not a valid DynamoDB stream event name.`);
  }
};

/**
 * Compares the old and new images of a ModifyRecord to determine if a given property has changed.
 * Only supports primitive types (boolean, number, string and undefined).
 * @param record Parsed record
 * @param property Name of the property to check for changes
 */
export const hasPropertyChanged = <T>(record: ModifyRecord<T>, property: keyof T) => {
  const supportedTypes = [ 'boolean', 'number', 'string', 'undefined' ];
  if (!supportedTypes.includes(typeof record.oldImage[property]) || !supportedTypes.includes(typeof record.newImage[property])) {
    throw new Error(`hasPropertyChanged() does not support type "${typeof record.newImage[property]}".`);
  }
  return record.oldImage[property] !== record.newImage[property];
};

/**
 * Check if two objects are equal.
 * Recursively check inner objects.
 * @param o1 First object to be compared.
 * @param o2 Second object to be compared.
 */
export const objectsEqual = (o1: any, o2: any): boolean =>
  typeof o1 === 'object' && typeof o2 === 'object' && Object.keys(o1).length > 0
    ? Object.keys(o1).length === Object.keys(o2).length && Object.keys(o1).every(key => objectsEqual(o1[key], o2[key]))
    : o1 === o2;

/**
 * Check if two arrays are equal.
 * Recursively check the objects that are contained in the array.
 * @param a1 First array to be compared.
 * @param a2 Second array to be compared.
 */
export const arraysEqual = (a1: any[], a2: any[]): boolean =>
  a1.length === a2.length && a1.every((obj: any, index: any) => objectsEqual(obj, a2[index]));