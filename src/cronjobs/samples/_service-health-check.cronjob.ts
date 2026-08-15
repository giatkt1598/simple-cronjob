import { CronJob } from "../../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../../core/types.js";
import {
  HealthCheckService,
  MsTeamsService,
  SlackService,
  SmtpEmailService,
  type SmtpEmailConfig,
} from "../../services/index.js";

const HEALTH_CHECK_CONFIG = {
  url: "http://localhost:8080/health",
  timeoutMs: 10_000,
  expectedStatuses: [200],
};

const SMTP_CONFIG: SmtpEmailConfig = {
  host: "localhost",
  port: 11025,
  secure: false,
  ignoreTLS: true,
};

const ALERT_CONFIG = {
  slackWebhookUrl: "",
  msTeamsWebhookUrl: "",
  emailTo: "on-call@example.com",
  emailFrom: "cronjob@localhost",
  emailSubject: "Service health check failed",
};

@CronJob({
  description: "Check a service health endpoint and notify configured channels on failure.",
  schedule: "*/5 * * * *",
  enabled: false,
})
export class ServiceHealthCheckSampleJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    try {
      const result = await new HealthCheckService(HEALTH_CHECK_CONFIG).check();
      context.logger.info("Service health check passed", { Url: HEALTH_CHECK_CONFIG.url, Status: result.status });
    } catch (error) {
      const message = `Service health check failed for ${HEALTH_CHECK_CONFIG.url}: ${error instanceof Error ? error.message : String(error)}`;
      context.logger.error("Service health check failed", error, { Url: HEALTH_CHECK_CONFIG.url });
      await notifyFailure(context, message);
      throw error;
    }
  }
}

async function notifyFailure(context: CronJobContext, message: string): Promise<void> {
  if (ALERT_CONFIG.slackWebhookUrl) {
    try {
      await new SlackService({ webhookUrl: ALERT_CONFIG.slackWebhookUrl }).sendText(message);
      context.logger.info("Health alert sent to Slack");
    } catch (error) {
      context.logger.error("Health alert failed for Slack", error);
    }
  }

  if (ALERT_CONFIG.msTeamsWebhookUrl) {
    try {
      await new MsTeamsService({ webhookUrl: ALERT_CONFIG.msTeamsWebhookUrl }).sendText(message);
      context.logger.info("Health alert sent to Microsoft Teams");
    } catch (error) {
      context.logger.error("Health alert failed for Microsoft Teams", error);
    }
  }

  if (ALERT_CONFIG.emailTo) {
    try {
      await new SmtpEmailService(SMTP_CONFIG).sendMail({
        from: ALERT_CONFIG.emailFrom,
        to: ALERT_CONFIG.emailTo,
        subject: ALERT_CONFIG.emailSubject,
        text: message,
      });
      context.logger.info("Health alert sent by email", { To: ALERT_CONFIG.emailTo });
    } catch (error) {
      context.logger.error("Health alert failed for email", error, { To: ALERT_CONFIG.emailTo });
    }
  }
}
