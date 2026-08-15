import { CronExpression } from "./cron.js";
import { JobLock } from "./job-lock.js";
import { JobLogger } from "./logger.js";
import { parseStartAt } from "./start-at.js";
import type { CronJobLogger, RegisteredCronJob } from "./types.js";

export type RunJobResult = "completed" | "skipped";

export function shouldRun(job: RegisteredCronJob, now: Date): boolean {
  if (job.startAt && dayjsIsBeforeStartAt(job.startAt, now)) return false;
  if (job.stopAt && !parseStartAt(job.stopAt).isAfter(now)) return false;
  return new CronExpression(job.schedule).matches(now);
}

function dayjsIsBeforeStartAt(startAt: string, now: Date): boolean {
  return parseStartAt(startAt).isAfter(now);
}

export async function runJob(job: RegisteredCronJob, projectRoot: string, scheduledAt = new Date(), logger?: CronJobLogger): Promise<RunJobResult> {
  const activeLogger = logger ?? new JobLogger(projectRoot, job.id);
  const lockHandle = job.parallel ? undefined : await new JobLock(projectRoot, job.id).acquire();
  if (!job.parallel && !lockHandle) {
    activeLogger.info("Job skipped because another instance is running", { JobId: job.id });
    await activeLogger.flush?.();
    return "skipped";
  }
  if (lockHandle?.staleRecovered) activeLogger.warn("Stale job lock recovered", { JobId: job.id });
  activeLogger.info("Job started", { JobId: job.id, Schedule: job.schedule, ScheduledAt: scheduledAt.toISOString() });
  try {
    await new job.constructor().execute({ jobId: job.id, description: job.description, schedule: job.schedule, projectRoot, scheduledAt, logger: activeLogger });
    activeLogger.info("Job completed", { JobId: job.id });
  } catch (error) {
    activeLogger.error("Job failed", error, { JobId: job.id });
    throw error;
  } finally {
    try {
      await lockHandle?.release();
    } finally {
      await activeLogger.flush?.();
    }
  }
  return "completed";
}
