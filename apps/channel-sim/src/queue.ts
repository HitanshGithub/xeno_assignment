import { createLogger } from './logger';

const log = createLogger('queue');

export interface RetryQueueOptions {
  name: string;
  /** Max tasks running at once — models provider-side throughput. */
  concurrency: number;
  /** Total attempts before a task is dead-lettered. */
  maxAttempts: number;
  /** Base for exponential backoff (attempt n waits ~base * 2^(n-1) + jitter). */
  baseDelayMs: number;
  onDeadLetter?: (describe: string, error: unknown) => void;
}

interface QueuedTask {
  run: () => Promise<void>;
  describe: string;
  attempt: number;
}

/**
 * A bounded-concurrency work queue with exponential backoff + jitter and a
 * dead-letter hook.
 *
 * This is the in-process stand-in for what would be SQS / Redis Streams at
 * scale — kept behind a small interface precisely so it could be swapped
 * without touching callers. It is deliberately the thing that wraps the
 * *receipt callback*, because that network hop is where real systems lose,
 * delay, and retry events.
 */
export class RetryQueue {
  private readonly pending: QueuedTask[] = [];
  private active = 0;
  private readonly opts: RetryQueueOptions;

  readonly metrics = {
    enqueued: 0,
    succeeded: 0,
    failed: 0, // individual attempt failures
    retried: 0,
    deadLettered: 0,
  };

  constructor(opts: RetryQueueOptions) {
    this.opts = opts;
  }

  enqueue(run: () => Promise<void>, describe: string): void {
    this.metrics.enqueued += 1;
    this.pending.push({ run, describe, attempt: 1 });
    this.pump();
  }

  /** Snapshot of live depth for /stats. */
  depth(): { pending: number; active: number } {
    return { pending: this.pending.length, active: this.active };
  }

  private backoff(attempt: number): number {
    const exp = this.opts.baseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.random() * this.opts.baseDelayMs;
    return exp + jitter;
  }

  private pump(): void {
    while (this.active < this.opts.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.active += 1;
      void this.execute(task);
    }
  }

  private async execute(task: QueuedTask): Promise<void> {
    try {
      await task.run();
      this.metrics.succeeded += 1;
    } catch (err) {
      this.metrics.failed += 1;
      if (task.attempt < this.opts.maxAttempts) {
        const delay = this.backoff(task.attempt);
        this.metrics.retried += 1;
        log.warn(`retrying ${task.describe}`, {
          queue: this.opts.name,
          attempt: task.attempt,
          nextInMs: Math.round(delay),
          error: err instanceof Error ? err.message : String(err),
        });
        setTimeout(() => {
          this.pending.push({ ...task, attempt: task.attempt + 1 });
          this.pump();
        }, delay);
      } else {
        this.metrics.deadLettered += 1;
        log.error(`dead-lettered ${task.describe}`, {
          queue: this.opts.name,
          attempts: task.attempt,
          error: err instanceof Error ? err.message : String(err),
        });
        this.opts.onDeadLetter?.(task.describe, err);
      }
    } finally {
      this.active -= 1;
      this.pump();
    }
  }
}
