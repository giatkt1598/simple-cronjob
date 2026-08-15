#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverCronJobs } from "./core/discovery.js";
import { JobLogger } from "./core/logger.js";
import { runJob, shouldRun } from "./core/runner.js";
import { parseStartAt } from "./core/start-at.js";
import { createTaskScheduler } from "./core/task-scheduler.js";
import type { RegisteredCronJob } from "./core/types.js";

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
    for (const job of jobs)
      console.log(
        `${job.id}\t${job.enabled ? "enabled" : "disabled"}\t${job.schedule}\t${job.startAt ?? "immediate"}\t${job.stopAt ?? "none"}\t${job.description}`,
      );
    return;
  }
  if (command === "register") {
    const now = new Date();
    const registerableJobs = jobs.filter((job) => isRegisterable(job, now));
    const skippedJobs = jobs.filter((job) => !isRegisterable(job, now));
    await createTaskScheduler().reconcile(jobs, projectRoot);
    console.log(`Registered ${registerableJobs.length} cronjob(s):`);
    printNumberedJobs(registerableJobs, (job) => job.id);
    if (skippedJobs.length > 0) {
      console.log(`Skipped ${skippedJobs.length} cronjob(s):`);
      printNumberedJobs(skippedJobs, formatSkippedJob);
    }
    return;
  }
  if (command === "run") {
    const jobId = process.argv[process.argv.indexOf("--job") + 1];
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown cronjob "${jobId ?? ""}".`);
    const now = new Date();
    if (job.stopAt && !parseStartAt(job.stopAt).isAfter(now)) {
      await createTaskScheduler().remove(job.id);
      return;
    }
    if (!shouldRun(job, now)) return;
    await runJob(job, projectRoot, now, new JobLogger(projectRoot, job.id));
    return;
  }
  if (command === "trigger") {
    const optionIndex = process.argv.indexOf("--job");
    const jobId =
      optionIndex >= 0 ? process.argv[optionIndex + 1] : process.argv[3];
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown cronjob "${jobId ?? ""}".`);
    const now = new Date();
    if (job.stopAt && !parseStartAt(job.stopAt).isAfter(now)) {
      await createTaskScheduler().remove(job.id);
      return;
    }
    await runJob(job, projectRoot, now, new JobLogger(projectRoot, job.id));
    return;
  }
  throw new Error(
    `Unknown command "${command}". Use list, validate, register, run --job <id> or trigger <id>.`,
  );
}

function isRegisterable(job: RegisteredCronJob, now: Date): boolean {
  return job.enabled && (!job.stopAt || parseStartAt(job.stopAt).isAfter(now));
}

function printNumberedJobs(jobs: RegisteredCronJob[], format: (job: RegisteredCronJob) => string): void {
  if (jobs.length === 0) {
    console.log("  (none)");
    return;
  }
  jobs.forEach((job, index) => console.log(`  ${index + 1}. ${format(job)}`));
}

function formatSkippedJob(job: RegisteredCronJob): string {
  const reason = !job.enabled ? "disabled" : "stopAt reached";
  return `${job.id} (${reason})`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
