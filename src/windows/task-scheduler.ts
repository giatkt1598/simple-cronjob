import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import dayjs from "dayjs";
import { parseStartAt } from "../core/start-at.js";
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
    const now = new Date();
    const wanted = new Set(jobs.filter((job) => job.enabled && (!job.stopAt || parseStartAt(job.stopAt).isAfter(now))).map((job) => `${TASK_PREFIX}${job.id}`));
    for (const taskName of existing) if (!wanted.has(taskName)) await this.delete(taskName);
    for (const job of jobs) {
      if (job.enabled && (!job.stopAt || parseStartAt(job.stopAt).isAfter(now))) await this.createOrUpdate(job, projectRoot, nodePath);
    }
  }

  async remove(jobId: string): Promise<void> {
    if (process.platform !== "win32") return;
    await this.delete(`${TASK_PREFIX}${jobId}`, true);
  }

  private async createOrUpdate(job: RegisteredCronJob, projectRoot: string, nodePath: string): Promise<void> {
    const taskName = `${TASK_PREFIX}${job.id}`;
    const scriptPath = `${projectRoot}\\dist\\index.js`;
    const launcherPath = `${projectRoot}\\dist\\run-job.vbs`;
    const wscriptPath = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\wscript.exe`;
    const action = `"${wscriptPath}" "${launcherPath}" "${nodePath}" "${scriptPath}" "${job.id}"`;
    const user = `${process.env.USERDOMAIN ?? ""}\\${process.env.USERNAME ?? ""}`.replace(/^\\/u, "");
    const temporaryDirectory = join(tmpdir(), `simple-cronjob-${job.id}-${process.pid}`);
    const xmlPath = join(temporaryDirectory, `${job.id}.xml`);
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(xmlPath, `\ufeff${createTaskXml({ action, user, parallel: job.parallel, startAt: job.startAt })}`, "utf16le");
    try {
      await execFileAsync("schtasks.exe", ["/Create", "/XML", xmlPath, "/TN", taskName, "/F"], { windowsHide: true });
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  private async delete(taskName: string, ignoreMissing = false): Promise<void> {
    try {
      await execFileAsync("schtasks.exe", ["/Delete", "/TN", taskName, "/F"], { windowsHide: true });
    } catch (error) {
      if (!ignoreMissing || !String(error).includes("cannot find")) throw error;
    }
  }

  private async listManagedTasks(): Promise<string[]> {
    const { stdout } = await execFileAsync("schtasks.exe", ["/Query", "/FO", "CSV", "/NH"], { windowsHide: true });
    return stdout.split(/\r?\n/u).map((line) => line.match(/^"([^"]+)"/u)?.[1]).filter((name): name is string => Boolean(name?.startsWith(TASK_PREFIX)));
  }
}

function createTaskXml(input: { action: string; user: string; parallel: boolean; startAt?: string }): string {
  const nextMinute = dayjs().add(1, "minute").second(0).millisecond(0);
  const configuredStart = input.startAt ? parseStartAt(input.startAt) : undefined;
  const start = configuredStart?.isAfter(nextMinute) ? configuredStart : nextMinute;
  const startBoundary = start.format("YYYY-MM-DDTHH:mm:ss");
  const commandEnd = input.action.indexOf(" ");
  const command = input.action.slice(0, commandEnd);
  const argumentsValue = input.action.slice(commandEnd + 1);
  const policy = input.parallel ? "Parallel" : "IgnoreNew";
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Author>${xml(input.user)}</Author></RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>${startBoundary}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition><Interval>PT1M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition>
    </TimeTrigger>
  </Triggers>
  <Principals><Principal id="Author"><UserId>${xml(input.user)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>${policy}</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT72H</ExecutionTimeLimit></Settings>
  <Actions Context="Author"><Exec><Command>${xml(command)}</Command><Arguments>${xml(argumentsValue)}</Arguments></Exec></Actions>
</Task>
`;
}

function xml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}
