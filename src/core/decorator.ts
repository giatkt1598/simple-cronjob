import type { CronJobConstructor, CronJobOptions } from "./types.js";

export const CRONJOB_META = "__simple_cronjob_meta__";

export function CronJob(options: CronJobOptions): ClassDecorator {
  return (target) => {
    Object.defineProperty(target, CRONJOB_META, {
      value: { ...options, enabled: options.enabled ?? true, parallel: options.parallel ?? false },
      enumerable: false,
      writable: false,
    });
  };
}

export function getCronJobOptions(target: CronJobConstructor): CronJobOptions | undefined {
  return (target as unknown as Record<string, unknown>)[CRONJOB_META] as CronJobOptions | undefined;
}
