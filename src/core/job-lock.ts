import { mkdir, open, readFile, rm } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

interface LockMetadata {
  token: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
}

export interface JobLockHandle {
  /** Indicates that an abandoned lock file was removed before acquisition. */
  staleRecovered: boolean;
  /** Releases the lock only when this handle still owns it. */
  release(): Promise<void>;
}

/** File-based process lock used to prevent overlapping job executions. */
export class JobLock {
  private readonly lockPath: string;

  constructor(projectRoot: string, private readonly jobId: string) {
    this.lockPath = join(projectRoot, "logs", ".locks", `${jobId}.lock`);
  }

  /** Acquires the lock, or returns `undefined` when another process owns it. */
  async acquire(): Promise<JobLockHandle | undefined> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    let staleRecovered = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const metadata: LockMetadata = {
        token: randomUUID(),
        pid: process.pid,
        hostname: hostname(),
        acquiredAt: new Date().toISOString(),
      };
      try {
        const file = await open(this.lockPath, "wx");
        await file.writeFile(JSON.stringify(metadata, null, 2), "utf8");
        await file.close();
        return { staleRecovered, release: () => this.release(metadata.token) };
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        const existing = await this.readMetadata();
        if (existing && isProcessAlive(existing.pid)) return undefined;
        await rm(this.lockPath, { force: true });
        staleRecovered = true;
      }
    }
    return undefined;
  }

  private async readMetadata(): Promise<LockMetadata | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(this.lockPath, "utf8"));
      if (!isLockMetadata(value)) return undefined;
      return value;
    } catch {
      return undefined;
    }
  }

  private async release(token: string): Promise<void> {
    const current = await this.readMetadata();
    if (current?.token === token) await rm(this.lockPath, { force: true });
  }
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isLockMetadata(value: unknown): value is LockMetadata {
  if (typeof value !== "object" || value === null) return false;
  const metadata = value as Partial<LockMetadata>;
  return typeof metadata.token === "string" && typeof metadata.pid === "number" && typeof metadata.hostname === "string" && typeof metadata.acquiredAt === "string";
}
