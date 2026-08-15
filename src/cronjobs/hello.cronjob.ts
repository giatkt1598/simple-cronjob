import { CronJob } from "../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../core/types.js";

@CronJob({
  description: "Write a heartbeat message to stdout.",
  schedule: "* * * * *",
})
export class HelloJob implements CronJobHandler {
  execute(context: CronJobContext): void {
    context.logger.info(`[${context.jobId}] heartbeat`);
  }
}
