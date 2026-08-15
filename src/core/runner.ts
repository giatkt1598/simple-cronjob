import { CronExpression } from "./cron.js";
import { JobLogger } from "./logger.js";
import type { CronJobLogger, RegisteredCronJob } from "./types.js";

export function shouldRun(job: RegisteredCronJob, now: Date): boolean {
  return new CronExpression(job.schedule).matches(now);
}

export async function runJob(job: RegisteredCronJob, projectRoot: string, scheduledAt = new Date(), logger?: CronJobLogger): Promise<void> {
  const activeLogger = logger ?? new JobLogger(projectRoot, job.id);
  activeLogger.info("Job started", { JobId: job.id, Schedule: job.schedule, ScheduledAt: scheduledAt.toISOString() });
  try {
    await new job.constructor().execute({ jobId: job.id, description: job.description, schedule: job.schedule, projectRoot, scheduledAt, logger: activeLogger });
    activeLogger.info("Job completed", { JobId: job.id });
  } catch (error) {
    activeLogger.error("Job failed", error, { JobId: job.id });
    throw error;
  } finally {
    await activeLogger.flush?.();
  }
}
