import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RegisteredCronJob } from "../core/types.js";

const execFileAsync = promisify(execFile);
const TASK_PREFIX = "\\SimpleCronJob\\";

export interface TaskScheduler {
  reconcile(jobs: RegisteredCronJob[], projectRoot: string, nodePath?: string): Promise<void>;
}

export class WindowsTaskScheduler implements TaskScheduler {
  async reconcile(jobs: RegisteredCronJob[], projectRoot: string, nodePath = process.execPath): Promise<void> {
    if (process.platform !== "win32") throw new Error("WindowsTaskScheduler can only run on Windows.");
    const existing = await this.listManagedTasks();
    const wanted = new Set(jobs.filter((job) => job.enabled).map((job) => `${TASK_PREFIX}${job.id}`));
    for (const taskName of existing) if (!wanted.has(taskName)) await this.delete(taskName);
    for (const job of jobs) {
      if (job.enabled) await this.createOrUpdate(job, projectRoot, nodePath);
    }
  }

  private async createOrUpdate(job: RegisteredCronJob, projectRoot: string, nodePath: string): Promise<void> {
    const taskName = `${TASK_PREFIX}${job.id}`;
    const scriptPath = `${projectRoot}\\dist\\index.js`;
    const action = `"${nodePath}" "${scriptPath}" run --job "${job.id}"`;
    const user = `${process.env.USERDOMAIN ?? ""}\\${process.env.USERNAME ?? ""}`.replace(/^\\/u, "");
    await execFileAsync("schtasks.exe", ["/Create", "/SC", "MINUTE", "/MO", "1", "/TN", taskName, "/TR", action, "/RU", user, "/IT", "/F"], { windowsHide: true });
  }

  private async delete(taskName: string): Promise<void> {
    await execFileAsync("schtasks.exe", ["/Delete", "/TN", taskName, "/F"], { windowsHide: true });
  }

  private async listManagedTasks(): Promise<string[]> {
    const { stdout } = await execFileAsync("schtasks.exe", ["/Query", "/FO", "CSV", "/NH"], { windowsHide: true });
    return stdout.split(/\r?\n/u).map((line) => line.match(/^"([^"]+)"/u)?.[1]).filter((name): name is string => Boolean(name?.startsWith(TASK_PREFIX)));
  }
}
