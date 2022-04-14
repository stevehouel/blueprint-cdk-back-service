import Axios, { AxiosRequestConfig } from 'axios';
import { promisify } from 'util';

const setTimeoutPromise = promisify(setTimeout);

const MAX_ATTEMPTS = 10;
const SLEEP_TIME_MS = 100;

/**
 * Generate and action client with the specified parameters.
 * @param baseURL Axios base url.
 * @param accessToken API JWT access token.
 * @returns Axios client.
 */
export function getAxiosClient(baseURL: string, accessToken?: string) {
  const headers: AxiosRequestConfig['headers'] = {};
  if (accessToken) {
    headers.Authorization = accessToken;
  }
  return Axios.create({
    baseURL,
    headers,
  });
}

/**
 * Retries a number of steps waiting a period of time.
 * @param fn function to execute.
 * @param attempts number of retries.
 * @param sleepTime time to sleep.
 */
export function expectEventually(fn: any, attempts = MAX_ATTEMPTS, sleepTime = SLEEP_TIME_MS) {
  return fn()
    .catch((error: unknown) => {
      if (attempts > 0) {
        const sleep = sleepTime * 2;
        return setTimeoutPromise(sleep)
          .then(() => expectEventually(fn, attempts - 1, sleep));
      } else {
        throw error;
      }
    });
}
