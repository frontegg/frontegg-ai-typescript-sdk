import logger from './logger';
import { ClientRetryConfiguration } from './types/client-retry-configuration';

export async function retryFunction<T>(fn: () => Promise<T>, options: ClientRetryConfiguration): Promise<T> {
  let attempt = 1;

  const execute = async (): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= options.tries || (options.retryIf && !options.retryIf(error))) {
        throw error;
      }
      const delayMs = (options.delayFn ?? ((attempt: number, delayInMs: number) => delayInMs * 2 ** attempt))(
        attempt,
        options.delayInMs,
      );
      logger.info('retrying function', { functionName: fn.name, attempt, delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      attempt++;
      return execute();
    }
  };

  return execute();
}
