import nodemailer, { type Transporter } from "nodemailer";

export interface SmtpEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  ignoreTLS: boolean;
  user?: string;
  password?: string;
}

export interface EmailMessage {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

/** Sends email through an SMTP server. */
export class SmtpEmailService {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpEmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ignoreTLS: config.ignoreTLS,
      ...(config.user && config.password
        ? { auth: { user: config.user, pass: config.password } }
        : {}),
    });
  }

  /** Creates an SMTP service from environment variables. */
  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): SmtpEmailService {
    return new SmtpEmailService({
      host: env.SMTP_HOST?.trim() || "localhost",
      port: parsePort(env.SMTP_PORT, 11025),
      secure: parseBoolean(env.SMTP_SECURE, false),
      ignoreTLS: parseBoolean(env.SMTP_IGNORE_TLS, true),
      user: env.SMTP_USER?.trim() || undefined,
      password: env.SMTP_PASSWORD || undefined,
    });
  }

  /** Sends one email message. */
  async sendMail(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail(message);
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

function parsePort(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") return defaultValue;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SMTP port "${value}".`);
  }
  return port;
}
