import { join } from "node:path";
import { CronJob } from "../../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../../core/types.js";
import {
  PostgresBackupService,
  type PostgresBackupConfig,
} from "../../services/index.js";

const POSTGRES_CONFIG: PostgresBackupConfig = {
  host: "localhost",
  port: 5432,
  database: "app",
  username: "postgres",
  password: "replace-with-database-password",
  outputDirectory: "backups/postgres",
  pgDumpPath: "pg_dump",
  timeoutMs: 10 * 60 * 1000,
};

@CronJob({
  description: "Create a daily PostgreSQL custom-format backup.",
  schedule: "0 2 * * *",
})
export class PostgresBackupSampleJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    const service = new PostgresBackupService({
      ...POSTGRES_CONFIG,
      outputDirectory: join(
        context.projectRoot,
        POSTGRES_CONFIG.outputDirectory,
      ),
    });
    const result = await service.backup(context.scheduledAt);
    context.logger.info("PostgreSQL backup completed", {
      OutputPath: result.outputPath,
      Database: POSTGRES_CONFIG.database,
    });
  }
}
