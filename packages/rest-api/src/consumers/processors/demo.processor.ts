import {DemoItem} from 'data-models';
import {RecordProcessor} from '../consumer.controller';
import {ParsedRecord} from '../../utils/consumer.helpers';
import {NotificationIntent} from '../../notifications/models/notification';

export default class DemoRecordProcessor extends RecordProcessor<DemoItem> {

  constructor() {
    super();
  }

  async process(record: ParsedRecord<DemoItem>) {
    const notifications: NotificationIntent[] = [];
    // TODO Implementation goes here
    return { notifications };
  }
}
