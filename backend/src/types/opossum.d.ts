import CircuitBreaker from 'opossum';

declare module 'opossum' {
  interface CircuitBreaker<TI extends unknown[], TR> {
    stats: {
      failures: number;
      fallbacks: number;
      successes: number;
      rejects: number;
      timeouts: number;
      latencyTimes: {
        percentile(p: number): number;
      };
    };
    opened: boolean;
    halfOpen: boolean;
    fire(...args: TI): Promise<TR>;
    fallback(fn: (...args: TI) => TR | Promise<TR>): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
  }
}

export = CircuitBreaker;
