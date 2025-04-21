export class ClientRetryConfiguration {
  tries: number;
  delayInMs: number;
  retryIf?: (error: Error) => boolean;
  delayFn?: (attempt: number, delayInMs: number) => number;
  constructor(
    tries = 1,
    delayInMs = 1000,
    retryIf?: (error: Error) => boolean,
    delayFn?: (attempt: number, delayInMs: number) => number,
  ) {
    this.tries = tries;
    this.delayInMs = delayInMs;
    this.retryIf = retryIf;
    this.delayFn = delayFn;
  }
}
