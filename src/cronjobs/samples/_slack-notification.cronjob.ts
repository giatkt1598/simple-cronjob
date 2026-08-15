import { CronJob } from "../../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../../core/types.js";
import { SlackService } from "../../services/index.js";

const SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/replace/with/webhook";
const MESSAGE = "Simple Cronjob scheduled notification";

@CronJob({
  description: "Send a scheduled text message to Slack.",
  schedule: "0 * * * *",
  enabled: false,
})
export class SlackNotificationSampleJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    await new SlackService({ webhookUrl: SLACK_WEBHOOK_URL }).sendText(MESSAGE);
    context.logger.info("Slack notification sent");
  }
}
