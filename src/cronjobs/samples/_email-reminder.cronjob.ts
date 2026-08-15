import { CronJob } from "../../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../../core/types.js";
import { SmtpEmailService, type SmtpEmailConfig } from "../../services/index.js";

const SMTP_CONFIG: SmtpEmailConfig = {
  host: "localhost",
  port: 11025,
  secure: false,
  ignoreTLS: true,
};

const EMAIL_CONFIG = {
  from: "cronjob@localhost",
  to: "recipient@example.com",
  subject: "Scheduled reminder",
  text: "This is an automated reminder from Simple Cronjob.",
};

@CronJob({
  description: "Send a daily reminder email through the configured SMTP server.",
  schedule: "0 9 * * *",
  enabled: false,
})
export class EmailReminderSampleJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    await new SmtpEmailService(SMTP_CONFIG).sendMail(EMAIL_CONFIG);
    context.logger.info("Reminder email sent", { To: EMAIL_CONFIG.to, Subject: EMAIL_CONFIG.subject });
  }
}
