#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverCronJobs } from "./core/discovery.js";
import { JobLogger } from "./core/logger.js";
import { runJob, shouldRun } from "./core/runner.js";
import { parseStartAt } from "./core/start-at.js";
import { WindowsTaskScheduler } from "./windows/task-scheduler.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jobsDirectory = join(dirname(fileURLToPath(import.meta.url)), "cronjobs");

async function main(): Promise<void> {
  const command = process.argv[2] ?? "list";
  const jobs = await discoverCronJobs(jobsDirectory);
  if (command === "validate") {
    console.log(`Validated ${jobs.length} cronjob(s).`);
    return;
  }
  if (command === "list") {
    for (const job of jobs) console.log(`${job.id}\t${job.enabled ? "enabled" : "disabled"}\t${job.schedule}\t${job.startAt ?? "immediate"}\t${job.stopAt ?? "none"}\t${job.description}`);
    return;
  }
  if (command === "register") {
    await new WindowsTaskScheduler().reconcile(jobs, projectRoot);
    console.log(`Registered ${jobs.length} cronjob(s) into Windows Task Scheduler.`);
    return;
  }
  if (command === "run") {
    const jobId = process.argv[process.argv.indexOf("--job") + 1];
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown cronjob "${jobId ?? ""}".`);
    const now = new Date();
    if (job.stopAt && !parseStartAt(job.stopAt).isAfter(now)) {
      await new WindowsTaskScheduler().remove(job.id);
      return;
    }
    if (!shouldRun(job, now)) return;
    await runJob(job, projectRoot, now, new JobLogger(projectRoot, job.id));
    return;
  }
  if (command === "trigger") {
    const optionIndex = process.argv.indexOf("--job");
    const jobId = optionIndex >= 0 ? process.argv[optionIndex + 1] : process.argv[3];
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown cronjob "${jobId ?? ""}".`);
    const now = new Date();
    if (job.stopAt && !parseStartAt(job.stopAt).isAfter(now)) {
      await new WindowsTaskScheduler().remove(job.id);
      return;
    }
    await runJob(job, projectRoot, now, new JobLogger(projectRoot, job.id));
    return;
  }
  throw new Error(`Unknown command "${command}". Use list, validate, register, run --job <id> or trigger <id>.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
