import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { parseStartAt } from "./start-at.js";
import type { RegisteredCronJob } from "./types.js";
import type { TaskScheduler } from "./task-scheduler.js";

const execFileAsync = promisify(execFile);
const BEGIN_MARKER = "# BEGIN SIMPLE-CRONJOB";
const END_MARKER = "# END SIMPLE-CRONJOB";

/** Registers jobs in the current Linux user's crontab. */
export class LinuxCronScheduler implements TaskScheduler {
  async reconcile(
    jobs: RegisteredCronJob[],
    projectRoot: string,
    nodePath = process.execPath,
  ): Promise<void> {
    this.assertLinux();
    const current = await readCrontab();
    const unmanaged = removeManagedBlock(current);
    const now = new Date();
    const activeJobs = jobs.filter((job) =>
      job.enabled && (!job.stopAt || parseStartAt(job.stopAt).isAfter(now)),
    );
    const block = createManagedBlock(activeJobs, projectRoot, nodePath);
    await writeCrontab(joinCrontab(unmanaged, block));
  }

  async remove(jobId: string): Promise<void> {
    this.assertLinux();
    const current = await readCrontab();
    const marker = jobMarker(jobId);
    const lines = current.split(/\r?\n/u);
    const withoutJob = lines.filter((line) => !line.includes(marker)).join("\n");
    const updated = withoutJob
      .split(/\r?\n/u)
      .filter((line) => line !== BEGIN_MARKER && line !== END_MARKER)
      .every((line) => !line.includes("# SIMPLE-CRONJOB:"))
      ? removeManagedBlock(withoutJob)
      : withoutJob;
    if (updated !== current) await writeCrontab(updated);
  }

  private assertLinux(): void {
    if (process.platform !== "linux") {
      throw new Error("LinuxCronScheduler can only run on Linux.");
    }
  }
}

async function readCrontab(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("crontab", ["-l"]);
    return stdout;
  } catch (error) {
    const details = error as { code?: number | string; stderr?: string };
    const message = `${details.stderr ?? ""} ${String(error)}`.toLowerCase();
    if (details.code === 1 && message.includes("no crontab")) return "";
    throw new Error(`Unable to read the current crontab. Is "crontab" installed? ${details.stderr ?? String(error)}`);
  }
}

async function writeCrontab(content: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("crontab", ["-"], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", (error) => reject(new Error(`Unable to execute "crontab": ${error.message}`)));
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Unable to install the crontab${stderr ? `: ${stderr.trim()}` : ` (exit code ${code})`}.`));
    });
    child.stdin.end(content);
  });
}

function createManagedBlock(jobs: RegisteredCronJob[], projectRoot: string, nodePath: string): string {
  if (jobs.length === 0) return "";
  const scriptPath = join(projectRoot, "dist", "index.js");
  const entries = jobs.map((job) => {
    const command = [shellQuote(nodePath), shellQuote(scriptPath), "run", "--job", shellQuote(job.id)].join(" ");
    return `* * * * * ${command} ${jobMarker(job.id)}`;
  });
  return [BEGIN_MARKER, ...entries, END_MARKER].join("\n");
}

function removeManagedBlock(crontab: string): string {
  const lines = crontab.split(/\r?\n/u);
  const begin = lines.indexOf(BEGIN_MARKER);
  const end = lines.indexOf(END_MARKER);
  if (begin < 0 || end < begin) return crontab;
  return [...lines.slice(0, begin), ...lines.slice(end + 1)].join("\n");
}

function joinCrontab(unmanaged: string, managedBlock: string): string {
  const base = unmanaged.trim();
  if (!managedBlock) return base ? `${base}\n` : "";
  return `${base ? `${base}\n` : ""}${managedBlock}\n`;
}

function jobMarker(jobId: string): string {
  return `# SIMPLE-CRONJOB:${encodeURIComponent(jobId)}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/gu, `'\\''`)}'`;
}
