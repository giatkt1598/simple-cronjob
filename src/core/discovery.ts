import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { CronExpression } from "./cron.js";
import { getCronJobOptions } from "./decorator.js";
import { normalizeStartAt, parseStartAt } from "./start-at.js";
import type { CronJobConstructor, RegisteredCronJob } from "./types.js";

/** Discovers, imports, and validates all cron job modules in a directory. */
export async function discoverCronJobs(directory: string): Promise<RegisteredCronJob[]> {
  const files = (await findCronJobFiles(directory)).sort();
  const jobs: RegisteredCronJob[] = [];
  const ids = new Set<string>();

  for (const fileName of files) {
    const filePath = join(directory, fileName);
    const fileInfo = parseCronJobFileName(fileName);
    const id = fileInfo.id;
    if (ids.has(id)) throw new Error(`Duplicate cronjob id "${id}".`);
    ids.add(id);
    const module = await import(pathToFileURL(filePath).href) as Record<string, unknown>;
    const constructors = Object.values(module).filter(isCronJobConstructor);
    if (constructors.length !== 1) throw new Error(`File "${fileName}" must export exactly one @CronJob class.`);
    const constructor = constructors[0]!;
    const options = getCronJobOptions(constructor);
    if (!options?.description.trim()) throw new Error(`Cronjob "${id}" needs a description.`);
    new CronExpression(options.schedule);
    const startAt = normalizeStartAt(options.startAt);
    const stopAt = normalizeStartAt(options.stopAt);
    if (startAt && stopAt && !parseStartAt(stopAt).isAfter(parseStartAt(startAt))) {
      throw new Error(`Cronjob "${id}" must have stopAt after startAt.`);
    }
    jobs.push({
      id,
      modulePath: filePath,
      description: options.description.trim(),
      schedule: options.schedule.trim(),
      startAt,
      stopAt,
      enabled: !fileInfo.disabled && options.enabled !== false,
      parallel: options.parallel === true,
      constructor,
    });
  }
  return jobs;
}

async function findCronJobFiles(directory: string, relativeDirectory = ""): Promise<string[]> {
  const currentDirectory = join(directory, relativeDirectory);
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findCronJobFiles(directory, relativePath));
    } else if (entry.isFile() && /\.cronjob\.(js|ts)$/u.test(entry.name)) {
      files.push(relativePath);
    }
  }
  return files;
}

/** Parses a cron job filename and applies the leading-underscore convention. */
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
