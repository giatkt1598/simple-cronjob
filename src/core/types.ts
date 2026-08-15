export interface CronJobOptions {
  description: string;
  schedule: string;
  enabled?: boolean;
}

export interface CronJobContext {
  jobId: string;
  description: string;
  schedule: string;
  projectRoot: string;
  scheduledAt: Date;
  logger: CronJobLogger;
}

export type LogProperties = Record<string, unknown>;

export interface CronJobLogger {
  trace(message: string, properties?: LogProperties): void;
  debug(message: string, properties?: LogProperties): void;
  info(message: string, properties?: LogProperties): void;
  warn(message: string, properties?: LogProperties): void;
  error(message: string, error?: unknown, properties?: LogProperties): void;
  fatal(message: string, error?: unknown, properties?: LogProperties): void;
  flush?(): Promise<void>;
}

export interface CronJobHandler {
  execute(context: CronJobContext): Promise<void> | void;
}

export type CronJobConstructor = new () => CronJobHandler;

export interface RegisteredCronJob {
  id: string;
  modulePath: string;
  description: string;
  schedule: string;
  enabled: boolean;
  constructor: CronJobConstructor;
}
