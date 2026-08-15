export interface MsTeamsServiceConfig {
  webhookUrl: string;
}

/** Sends text messages to Microsoft Teams through an incoming webhook. */
export class MsTeamsService {
  constructor(private readonly config: MsTeamsServiceConfig) {}

  /** Creates a Teams service from `MS_TEAMS_WEBHOOK_URL`. */
  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): MsTeamsService {
    const webhookUrl = env.MS_TEAMS_WEBHOOK_URL?.trim();
    if (!webhookUrl) throw new Error("MS_TEAMS_WEBHOOK_URL is missing.");
    return new MsTeamsService({ webhookUrl });
  }

  /** Sends a plain-text Teams message. */
  async sendText(text: string): Promise<void> {
    const response = await fetch(this.config.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`Microsoft Teams webhook returned HTTP ${response.status}.`);
  }
}
