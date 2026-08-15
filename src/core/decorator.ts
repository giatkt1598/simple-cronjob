import type { CronJobConstructor, CronJobOptions } from "./types.js";

export const CRONJOB_META = "__simple_cronjob_meta__";

/**
 * Decorates a class as a discoverable cron job.
 *
 * `enabled` defaults to `true` and `parallel` defaults to `false`. The
 * discovery layer validates the schedule and normalizes time boundaries.
 */
export function CronJob(options: CronJobOptions): ClassDecorator {
  return (target) => {
    Object.defineProperty(target, CRONJOB_META, {
      value: { ...options, enabled: options.enabled ?? true, parallel: options.parallel ?? false },
      enumerable: false,
      writable: false,
    });
  };
}

/** Returns the options stored by `CronJob`, if the class is decorated. */
export function getCronJobOptions(target: CronJobConstructor): CronJobOptions | undefined {
  return (target as unknown as Record<string, unknown>)[CRONJOB_META] as CronJobOptions | undefined;
}
