/**
 * Templates used by DataManager and steps files.
 *
 * When using those templates, pay attention to the fact that they are Omit<T>. All the
 * attributes representing ids are voluntarily left out, as well as attributes whose values are set
 * by the backend.
 */
import { Demo, DemoStatus } from '../models/index';


export const DEMO_TEMPLATE: Omit<Demo, 'id' | 'entityId' | 'version' | 'createdDate' | 'updatedDate'> = {
  demoStatus: 'CREATED' as DemoStatus,
  userId: 'tester'
};
