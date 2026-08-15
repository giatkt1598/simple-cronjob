import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CronExpression } from "../src/core/cron.js";
import { CronJob, getCronJobOptions } from "../src/core/decorator.js";
import { parseCronJobFileName } from "../src/core/discovery.js";
import { JobLogger } from "../src/core/logger.js";
import { JobLock } from "../src/core/job-lock.js";
import { normalizeStartAt } from "../src/core/start-at.js";

describe("CronExpression", () => {
  it("matches lists, ranges and steps", () => {
    const cron = new CronExpression("*/5 12-13 * * 1,3");
    expect(cron.matches(new Date(2026, 7, 17, 12, 10))).toBe(true);
    expect(cron.matches(new Date(2026, 7, 18, 12, 10))).toBe(false);
    expect(cron.matches(new Date(2026, 7, 17, 12, 11))).toBe(false);
  });

  it("rejects malformed expressions", () => {
    expect(() => new CronExpression("* * * *")).toThrow();
    expect(() => new CronExpression("61 * * * *")).toThrow();
  });

  it("defaults enabled to true and preserves disabled metadata", () => {
    @CronJob({ description: "Enabled", schedule: "* * * * *" })
    class EnabledJob {}

    @CronJob({ description: "Disabled", schedule: "* * * * *", enabled: false })
    class DisabledJob {}

    expect(getCronJobOptions(EnabledJob as never)?.enabled).toBe(true);
    expect(getCronJobOptions(EnabledJob as never)?.parallel).toBe(false);
    expect(getCronJobOptions(DisabledJob as never)?.enabled).toBe(false);
  });

  it("preserves parallel true metadata", () => {
    @CronJob({ description: "Parallel", schedule: "* * * * *", parallel: true })
    class ParallelJob {}

    expect(getCronJobOptions(ParallelJob as never)?.parallel).toBe(true);
  });

  it("validates startAt with the strict dayjs format", () => {
    expect(normalizeStartAt("2026-08-16 09:00:00")).toBe("2026-08-16 09:00:00");
    expect(() => normalizeStartAt("2026-08-16 9:00:00")).toThrow();
    expect(normalizeStartAt("2026-08-30 18:00:00")).toBe("2026-08-30 18:00:00");
  });

  it("treats a leading underscore as a disabled filename convention", () => {
    expect(parseCronJobFileName("backup.cronjob.ts")).toEqual({ id: "backup", disabled: false });
    expect(parseCronJobFileName("_backup.cronjob.ts")).toEqual({ id: "backup", disabled: true });
  });

  it("writes Serilog-style plain text to the job log path", async () => {
    const root = await mkdtemp(join(tmpdir(), "simple-cronjob-"));
    const logger = new JobLogger(root, "backup");
    const now = new Date();
    logger.info("Backup completed", { JobId: "backup", Count: 2 });
    await logger.flush();

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const content = await readFile(join(root, "logs", "backup", month, `log - backup - ${date}.txt`), "utf8");
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{2}:\d{2} INF\] Backup completed \{JobId="backup", Count=2\}/u);
    await rm(root, { recursive: true, force: true });
  });

  it("allows only one process lock owner at a time", async () => {
    const root = await mkdtemp(join(tmpdir(), "simple-cronjob-lock-"));
    const first = new JobLock(root, "backup");
    const second = new JobLock(root, "backup");
    const firstHandle = await first.acquire();
    expect(firstHandle).toBeDefined();
    expect(await second.acquire()).toBeUndefined();
    await firstHandle!.release();
    const secondHandle = await second.acquire();
    expect(secondHandle).toBeDefined();
    await secondHandle!.release();
    await rm(root, { recursive: true, force: true });
  });
});
