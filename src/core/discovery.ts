import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { CronExpression } from "./cron.js";
import { getCronJobOptions } from "./decorator.js";
import type { CronJobConstructor, RegisteredCronJob } from "./types.js";

export async function discoverCronJobs(directory: string): Promise<RegisteredCronJob[]> {
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.cronjob\.(js|ts)$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const jobs: RegisteredCronJob[] = [];
  const ids = new Set<string>();

  for (const fileName of files) {
    const fileInfo = parseCronJobFileName(fileName);
    const id = fileInfo.id;
    if (ids.has(id)) throw new Error(`Duplicate cronjob id "${id}".`);
    ids.add(id);
    const module = await import(pathToFileURL(join(directory, fileName)).href) as Record<string, unknown>;
    const constructors = Object.values(module).filter(isCronJobConstructor);
    if (constructors.length !== 1) throw new Error(`File "${fileName}" must export exactly one @CronJob class.`);
    const constructor = constructors[0]!;
    const options = getCronJobOptions(constructor);
    if (!options?.description.trim()) throw new Error(`Cronjob "${id}" needs a description.`);
    new CronExpression(options.schedule);
    jobs.push({
      id,
      modulePath: join(directory, fileName),
      description: options.description.trim(),
      schedule: options.schedule.trim(),
      enabled: !fileInfo.disabled && options.enabled !== false,
      parallel: options.parallel === true,
      constructor,
    });
  }
  return jobs;
}

export function parseCronJobFileName(fileName: string): { id: string; disabled: boolean } {
  const name = basename(fileName).replace(/\.cronjob\.(?:js|ts)$/u, "");
  const disabled = name.startsWith("_");
  const id = disabled ? name.slice(1) : name;
  if (!id) throw new Error(`Invalid cronjob filename "${fileName}".`);
  return { id, disabled };
}

function isCronJobConstructor(value: unknown): value is CronJobConstructor {
  return typeof value === "function" && getCronJobOptions(value as CronJobConstructor) !== undefined;
}
