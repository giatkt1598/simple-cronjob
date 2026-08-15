# Simple Cronjob

Simple Cronjob is a TypeScript-based automation tool for running scheduled jobs through Windows Task Scheduler or a Linux user's `crontab`.

A cron job is a regular TypeScript class. You describe its schedule and runtime behavior with the `@CronJob` decorator, then run the application to discover, validate, and reconcile jobs registered in the operating system scheduler.

## Features

- Define jobs as TypeScript classes.
- Use familiar five-field cron expressions.
- Register and reconcile jobs in Windows Task Scheduler or Linux `crontab`.
- Run arbitrary Node.js and CLI automation, including database backups, HTTP calls, notifications, and file operations.
- Support enabled/disabled jobs and filename-based disabling.
- Prevent overlapping executions by default with a process lock.
- Optionally allow parallel executions for a job.
- Configure optional `startAt` and `stopAt` boundaries.
- Write Serilog-style plain-text logs per job and per day.
- Trigger a job manually without waiting for its cron schedule.
- Reuse common command, filesystem, HTTP, environment, and retry utilities.

## Requirements

- Windows with Windows Task Scheduler, or Linux with `crontab`/`cron`.
- Node.js 18 or later.
- npm.

## Installation

```powershell
npm install
```

## Creating a Cron Job

Create a new file in `src/cronjobs/` using the `.cronjob.ts` suffix. Each file must export exactly one class decorated with `@CronJob`.

```ts
import { CronJob } from "../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../core/types.js";

@CronJob({
  description: "Back up the database every 15 minutes.",
  schedule: "*/15 * * * *",
  enabled: true,
  parallel: false,
  startAt: "2026-08-16 09:00:00",
  stopAt: "2026-08-30 18:00:00",
})
export class BackupDatabaseJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    context.logger.info("Database backup started.");
    // Use child_process, a database client, an HTTP client, or any other
    // Node.js-compatible library required by the job.
  }
}
```

The job ID is derived from the filename. For example:

```text
backup-database.cronjob.ts -> backup-database
```

Each job file must contain exactly one `@CronJob` class. The job description and cron expression are validated during discovery.

### Disabling a Job

`enabled` defaults to `true`. Set `enabled: false` to disable a job while keeping it visible to validation and listing commands.

You can also disable a job by prefixing its filename with `_`:

```text
_backup-database.cronjob.ts
```

The job ID remains `backup-database`. When reconciliation runs, the corresponding Task Scheduler task is removed or is not created.

### Preventing Overlapping Runs

`parallel` defaults to `false`. With the default setting, a new execution is skipped while the previous process for the same job is still running.

Set `parallel: true` to allow multiple processes of the same job to run concurrently. Task Scheduler is configured with a parallel multiple-instance policy for that job.

### Start and Stop Boundaries

`startAt` and `stopAt` are optional and use the following local Windows time format:

```text
YYYY-MM-DD HH:mm:ss
```

Before `startAt`, the job does not execute. At or after `stopAt`, the job does not execute and its Task Scheduler task is removed during the next reconciliation or trigger. If both values are specified, `stopAt` must be later than `startAt`.

## Commands

```powershell
# Validate all discovered cron jobs.
npm run validate

# List discovered jobs and their configuration.
npm run list

# Build the project and register jobs in the operating system scheduler.
npm run start

# Build the project and trigger one job immediately.
npm run trigger-job -- giatk-version

# Run a compiled job using the application entry point.
node dist/index.js run --job hello

# Trigger a compiled job immediately.
node dist/index.js trigger giatk-version
```

`npm run start` type-checks the project, builds the application, discovers cron jobs, and reconciles tasks with the operating system scheduler.

On Windows, the scheduler creates a Task Scheduler trigger every minute. On Linux, it creates a managed block in the current user's `crontab` with one entry per active job. In both cases, the application evaluates the five-field cron expression before executing the job.

The `trigger-job` command bypasses the cron schedule, but it still respects process locking and `parallel`. A job past its `stopAt` value is not executed.

## Operating System Schedulers

### Windows Task Scheduler

Jobs run under the current logged-on Windows user. The scheduler uses a hidden `wscript.exe` launcher so Node.js jobs can run in the background without opening a console window. The launcher preserves the user context, working directory, and Node.js process exit code.

After adding or changing a cron job, run `npm run start` to reconcile the registered tasks.

### Opening Task Scheduler

![Opening Task Scheduler from Windows Search](docs/screenshots/open-windows-task-scheduler.png)

### Registered SimpleCronJob Tasks

![Registered SimpleCronJob tasks in Windows Task Scheduler](docs/screenshots/windows-task-scheduler.png)

### Linux crontab

Linux support uses the current user's crontab and does not require root privileges. Make sure `cron` or `cronie` is installed and running, then run:

```bash
npm install
npm run start
crontab -l
```

The application manages only the following block and preserves unrelated crontab entries:

```cron
# BEGIN SIMPLE-CRONJOB
* * * * * '/usr/bin/node' '/opt/simple-cronjob/dist/index.js' run --job 'hello' # SIMPLE-CRONJOB:hello
# END SIMPLE-CRONJOB
```

The Linux scheduler triggers every active job once per minute. Cron matching, `startAt`, `stopAt`, and process locking remain handled by the application. Run `npm run start` again after adding, renaming, disabling, or expiring a job.

## Logging

Every job receives a `context.logger`. Logs are written to plain-text files using a Serilog-style format. Scheduled jobs do not write job output to the console.

Example:

```text
[2026-08-15 20:07:03.829] [INFO] Job completed {JobId="hello"}
```

Log files are stored using the following structure:

```text
logs/<job-id>/YYYY-MM/YYYY-MM-DD.log
```

Supported log levels are `trace`, `debug`, `info`, `warn`, `error`, and `fatal`. Timestamps and directory names use the local Windows timezone.

## Shared Utilities

Common utilities are exported from `src/utilities/index.ts`:

```ts
import {
  requestJson,
  retry,
  runCommand,
  writeJson,
} from "../utilities/index.js";

const command = await runCommand("giatk -v");
const response = await retry(
  () => requestJson("https://example.com/health"),
  { maxAttempts: 3, delayMs: 1_000 },
);

await writeJson("tmp/result.json", {
  command,
  status: response.status,
});
```

The current utility set includes:

- `runCommand` and `assertCommandSuccess`
- `retry` and `withTimeout`
- `requestText` and `requestJson`
- `ensureDirectory`, `fileExists`, `readJson`, and `writeJson`
- `getEnv` and `requireEnv`
- `isWindows`

## Sample Jobs and Services

The repository includes reusable examples in `src/cronjobs/samples/`. These samples are disabled by default because they can send external notifications or create database backups.

To enable a sample, remove the leading `_` from its filename, edit the `const` configuration values at the top of the job file, and run:

```powershell
npm run start
```

Available samples include:

- `_postgres-backup.cronjob.ts`: creates a daily PostgreSQL custom-format backup with `pg_dump`.
- `_email-reminder.cronjob.ts`: sends a scheduled email through SMTP.
- `_slack-notification.cronjob.ts`: sends a scheduled Slack Incoming Webhook message.
- `_ms-teams-notification.cronjob.ts`: sends a scheduled Microsoft Teams webhook message.
- `_service-health-check.cronjob.ts`: checks an HTTP health endpoint every five minutes and sends alerts when the check fails.

Reusable service implementations are exported from `src/services/index.ts`:

- `SmtpEmailService`
- `SlackService`
- `MsTeamsService`
- `PostgresBackupService`
- `HealthCheckService`

### PostgreSQL Backup Configuration

The PostgreSQL sample requires the `pg_dump` executable to be installed and available on `PATH`.

Edit `POSTGRES_CONFIG` in `_postgres-backup.cronjob.ts`:

```ts
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
```

The password is passed to `pg_dump` through the child process environment and is not included in the command arguments. The `pg_dump` executable must be installed and available on `PATH`, or `pgDumpPath` can point to its full path.

### SMTP Email Configuration

The email samples use the following defaults, suitable for the local SMTP server supplied for this project:

```ts
{
  host: "localhost",
  port: 11025,
  secure: false,
  ignoreTLS: true,
}
```

Edit `SMTP_CONFIG` and `EMAIL_CONFIG` in `_email-reminder.cronjob.ts`:

```ts
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
  text: "This is an automated reminder.",
};
```

If the SMTP server requires authentication, add `user` and `password` to `SMTP_CONFIG`.

### Slack and Microsoft Teams Configuration

Edit the constants at the top of the corresponding sample before enabling it:

```ts
const SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/replace/with/webhook";
const MESSAGE = "Scheduled Slack notification";

const MS_TEAMS_WEBHOOK_URL = "https://replace-with-microsoft-teams-webhook";
const MESSAGE = "Scheduled Microsoft Teams notification";
```

### Health Check and Failure Alerts

The health-check sample requires an HTTP endpoint. It accepts status `200` by default and can notify any configured combination of Slack, Microsoft Teams, and email.

Edit `HEALTH_CHECK_CONFIG`, `SMTP_CONFIG`, and `ALERT_CONFIG` in `_service-health-check.cronjob.ts`:

```ts
const HEALTH_CHECK_CONFIG = {
  url: "http://localhost:8080/health",
  timeoutMs: 10_000,
  expectedStatuses: [200, 204],
};

const ALERT_CONFIG = {
  slackWebhookUrl: "https://hooks.slack.com/services/replace/with/webhook",
  msTeamsWebhookUrl: "https://replace-with-microsoft-teams-webhook",
  emailTo: "on-call@example.com",
  emailFrom: "cronjob@localhost",
  emailSubject: "Service health check failed",
};
```

If the health check fails, the job logs the original failure, attempts each configured notification channel independently, logs notification failures, and then fails the job so the incident remains visible in Task Scheduler and the job log.

## Cron Expression Syntax

Cron fields use the following order:

```text
minute hour day-of-month month day-of-week
```

The parser supports numeric wildcards (`*`), lists, ranges, and steps. Sunday can be written as either `0` or `7`.

When both `day-of-month` and `day-of-week` are restricted, the expression matches when either field matches, following common Vixie cron behavior. If one of those fields is `*`, the other restricted field controls the day match.

For example:

```text
*/5 12-13 * * 1,3
```

This expression matches every five minutes during hours 12 and 13 on Mondays and Wednesdays.

The implementation currently does not support named values such as `MON` or `JAN`.

## Security and Configuration Notes

- The sample jobs intentionally use direct `const` configuration values in each `.cronjob.ts` file so they are easy to copy and customize.
- For production deployments, consider moving passwords, API keys, and webhook URLs to a protected configuration or secret-management system.
- Ensure the project and its build output are writable only by trusted users.
- Review command execution and filesystem operations in each job before registering it in Task Scheduler.

## License

This project is licensed under the [MIT License](LICENSE).
