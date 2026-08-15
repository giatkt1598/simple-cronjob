/** Configuration declared by the `@CronJob` decorator. */
export interface CronJobOptions {
  /** Human-readable description shown by validation and listing commands. */
  description: string;
  /** Five-field cron expression: minute, hour, day-of-month, month, day-of-week. */
  schedule: string;
  /** Whether the job is registered with Task Scheduler. Defaults to `true`. */
  enabled?: boolean;
  /** Whether overlapping processes are allowed. Defaults to `false`. */
  parallel?: boolean;
  /** Optional local Windows start time in `YYYY-MM-DD HH:mm:ss` format. */
  startAt?: string;
  /** Optional local Windows expiration time in `YYYY-MM-DD HH:mm:ss` format. */
  stopAt?: string;
}

/** Runtime context passed to a cron job's `execute` method. */
export interface CronJobContext {
  /** Stable ID derived from the cron job filename. */
  jobId: string;
  /** Trimmed description declared in the decorator. */
  description: string;
  /** Trimmed five-field cron expression declared in the decorator. */
  schedule: string;
  /** Absolute project root used for job files, logs, and utilities. */
  projectRoot: string;
  /** Time at which the current execution was scheduled. */
  scheduledAt: Date;
  /** Logger scoped to the current job. */
  logger: CronJobLogger;
}

/** Structured properties appended to a log entry. */
export type LogProperties = Record<string, unknown>;

/** Logging contract available to every cron job. */
export interface CronJobLogger {
  /** Writes a trace-level entry. */
  trace(message: string, properties?: LogProperties): void;
  /** Writes a debug-level entry. */
  debug(message: string, properties?: LogProperties): void;
  /** Writes an information-level entry. */
  info(message: string, properties?: LogProperties): void;
  /** Writes a warning-level entry. */
  warn(message: string, properties?: LogProperties): void;
  /** Writes an error-level entry and optionally includes an error object. */
  error(message: string, error?: unknown, properties?: LogProperties): void;
  /** Writes a fatal-level entry and optionally includes an error object. */
  fatal(message: string, error?: unknown, properties?: LogProperties): void;
  /** Waits until queued log writes have been flushed. */
  flush?(): Promise<void>;
}

/** Implemented by every discovered cron job class. */
export interface CronJobHandler {
  /** Executes the job's business logic. */
  execute(context: CronJobContext): Promise<void> | void;
}

/** Constructor type for a class implementing `CronJobHandler`. */
export type CronJobConstructor = new () => CronJobHandler;

/** Validated job metadata used by the runner and Task Scheduler adapter. */
export interface RegisteredCronJob {
  /** Stable ID derived from the source filename. */
  id: string;
  /** Absolute path to the discovered job module. */
  modulePath: string;
  /** Validated and trimmed job description. */
  description: string;
  /** Validated and trimmed cron expression. */
  schedule: string;
  /** Normalized local start time, if configured. */
  startAt?: string;
  /** Normalized local expiration time, if configured. */
  stopAt?: string;
  /** Effective enabled state, including the filename convention. */
  enabled: boolean;
  /** Effective parallel execution setting. */
  parallel: boolean;
  /** Job class constructor used to create an execution instance. */
  constructor: CronJobConstructor;
}
