export interface SlackServiceConfig {
  webhookUrl: string;
}

/** Sends text messages to Slack through an Incoming Webhook. */
export class SlackService {
  constructor(private readonly config: SlackServiceConfig) {}

  /** Creates a Slack service from `SLACK_WEBHOOK_URL`. */
  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): SlackService {
    const webhookUrl = env.SLACK_WEBHOOK_URL?.trim();
    if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL is missing.");
    return new SlackService({ webhookUrl });
  }

  /** Sends a plain-text Slack message. */
  async sendText(text: string): Promise<void> {
    const response = await fetch(this.config.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`Slack webhook returned HTTP ${response.status}.`);
  }
}
