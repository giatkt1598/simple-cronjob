import { CronJob } from "../../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../../core/types.js";
import { MsTeamsService } from "../../services/index.js";

const MS_TEAMS_WEBHOOK_URL = "https://replace-with-microsoft-teams-webhook";
const MESSAGE = "Simple Cronjob scheduled notification";

@CronJob({
  description: "Send a scheduled text message to Microsoft Teams.",
  schedule: "0 * * * *",
  enabled: false,
})
export class MsTeamsNotificationSampleJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    await new MsTeamsService({ webhookUrl: MS_TEAMS_WEBHOOK_URL }).sendText(MESSAGE);
    context.logger.info("Microsoft Teams notification sent");
  }
}
