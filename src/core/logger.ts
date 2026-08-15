import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CronJobLogger, LogProperties } from "./types.js";

type LogLevel = "TRC" | "DBG" | "INF" | "WRN" | "ERR" | "FTL";

export class JobLogger implements CronJobLogger {
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(
    private readonly projectRoot: string,
    private readonly jobId: string,
  ) {}

  trace(message: string, properties?: LogProperties): void {
    this.write("TRC", message, undefined, properties);
  }

  debug(message: string, properties?: LogProperties): void {
    this.write("DBG", message, undefined, properties);
  }

  info(message: string, properties?: LogProperties): void {
    this.write("INF", message, undefined, properties);
  }

  warn(message: string, properties?: LogProperties): void {
    this.write("WRN", message, undefined, properties);
  }

  error(message: string, error?: unknown, properties?: LogProperties): void {
    this.write("ERR", message, error, properties);
  }

  fatal(message: string, error?: unknown, properties?: LogProperties): void {
    this.write("FTL", message, error, properties);
  }

  async flush(): Promise<void> {
    await this.pendingWrite;
  }

  private write(
    level: LogLevel,
    message: string,
    error?: unknown,
    properties?: LogProperties,
  ): void {
    const now = new Date();
    const line = `${formatPrefix(now, level)} ${message}${formatProperties(properties)}${formatError(error)}\n`;
    const directory = join(
      this.projectRoot,
      "logs",
      this.jobId,
      formatMonth(now),
    );
    const filePath = join(directory, `${formatDate(now)}.log`);
    this.pendingWrite = this.pendingWrite.then(
      async () => {
        await mkdir(directory, { recursive: true });
        await appendFile(filePath, line, "utf8");
      },
      async () => {
        await mkdir(directory, { recursive: true });
        await appendFile(filePath, line, "utf8");
      },
    );
  }
}

function formatPrefix(date: Date, level: LogLevel): string {
  return `[${formatDateTime(date)} ${formatOffset(date)} ${level}]`;
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function formatProperties(properties?: LogProperties): string {
  if (!properties || Object.keys(properties).length === 0) return "";
  const values = Object.entries(properties).map(
    ([key, value]) => `${key}=${formatValue(value)}`,
  );
  return ` {${values.join(", ")}}`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof Error) return JSON.stringify(value.message);
  if (value === undefined) return "null";
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return JSON.stringify(String(value));
  }
}

function formatError(error: unknown): string {
  if (error === undefined) return "";
  if (error instanceof Error)
    return `\n${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  return `\n${String(error)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
