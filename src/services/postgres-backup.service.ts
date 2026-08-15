import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PostgresBackupConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  outputDirectory: string;
  pgDumpPath?: string;
  timeoutMs?: number;
}

export interface PostgresBackupResult {
  outputPath: string;
  stdout: string;
  stderr: string;
}

/** Creates compressed PostgreSQL backups with the `pg_dump` executable. */
export class PostgresBackupService {
  constructor(private readonly config: PostgresBackupConfig) {}

  /** Creates a backup service from standard PostgreSQL environment variables. */
  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): PostgresBackupService {
    const database = requireValue(env.PGDATABASE, "PGDATABASE");
    const username = requireValue(env.PGUSER, "PGUSER");
    return new PostgresBackupService({
      host: env.PGHOST?.trim() || "localhost",
      port: parsePort(env.PGPORT, 5432),
      database,
      username,
      password: env.PGPASSWORD,
      outputDirectory: env.POSTGRES_BACKUP_DIR?.trim() || "backups/postgres",
      pgDumpPath: env.PG_DUMP_PATH?.trim() || "pg_dump",
      timeoutMs: parsePositiveInteger(env.POSTGRES_BACKUP_TIMEOUT_MS, 10 * 60 * 1000),
    });
  }

  /** Runs `pg_dump` and returns the generated backup path and command output. */
  async backup(now = new Date()): Promise<PostgresBackupResult> {
    const directory = this.config.outputDirectory;
    await mkdir(directory, { recursive: true });
    const timestamp = formatTimestamp(now);
    const fileName = `${sanitizeFileName(this.config.database)}-${timestamp}.dump`;
    const outputPath = join(directory, fileName);
    const args = [
      "--host", this.config.host,
      "--port", String(this.config.port),
      "--username", this.config.username,
      "--format", "custom",
      "--file", outputPath,
      this.config.database,
    ];
    const { stdout, stderr } = await execFileAsync(this.config.pgDumpPath ?? "pg_dump", args, {
      env: { ...process.env, ...(this.config.password ? { PGPASSWORD: this.config.password } : {}) },
      timeout: this.config.timeoutMs,
      windowsHide: true,
    });
    return { outputPath, stdout, stderr };
  }
}

function requireValue(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is missing.`);
  return normalized;
}

function parsePort(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") return defaultValue;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PostgreSQL port "${value}".`);
  return port;
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Invalid positive integer "${value}".`);
  return parsed;
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/gu, "_");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
