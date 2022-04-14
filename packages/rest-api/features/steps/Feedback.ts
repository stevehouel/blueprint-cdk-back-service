import { AxiosError, AxiosResponse } from 'axios';
import { configuration } from './Shared';
import { getAxiosClient } from './tools';
import {When} from '@cucumber/cucumber';

const baseURL = `${configuration.apiUrl}/feedbacks`;

declare module '@cucumber/cucumber' {
  interface World {
    accessToken?: string;
    feedbackMessage: string;
    response?: AxiosResponse;
    error?: AxiosError;
  }
}

When('I create a new feedback', async function () {
  const client = getAxiosClient(baseURL, this.accessToken);
  await client.post('', {
    userId: 'demotester',
    rating: 5,
    message: 'I really like this product. Rock on!',
  }).then((resp) => this.response = resp)
    .catch((err) => this.error = err);
});
