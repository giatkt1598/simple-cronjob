import type { RegisteredCronJob } from "./types.js";
import { LinuxCronScheduler } from "./linux-cron-scheduler.js";
import { WindowsTaskScheduler } from "./windows-task-scheduler.js";

export interface TaskScheduler {
  /** Reconciles the desired cron jobs with the operating system scheduler. */
  reconcile(jobs: RegisteredCronJob[], projectRoot: string, nodePath?: string): Promise<void>;

  /** Removes one managed job from the operating system scheduler. */
  remove(jobId: string): Promise<void>;
}

/** Creates the scheduler adapter for the current operating system. */
export function createTaskScheduler(): TaskScheduler {
  if (process.platform === "win32") return new WindowsTaskScheduler();
  if (process.platform === "linux") return new LinuxCronScheduler();
  throw new Error(`Unsupported platform "${process.platform}". Supported platforms: win32, linux.`);
}
