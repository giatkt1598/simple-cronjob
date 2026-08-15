import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileExists, readJson, writeJson } from "../src/utilities/filesystem.js";
import { getEnv, isWindows, requireEnv } from "../src/utilities/environment.js";
import { requestJson } from "../src/utilities/http.js";
import { retry, withTimeout } from "../src/utilities/retry.js";
import { runCommand } from "../src/utilities/command.js";

describe("automation utilities", () => {
  it("runs a command and captures output", async () => {
    const result = await runCommand("cmd /d /c echo utility-test");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("utility-test");
  });

  it("retries a failing operation", async () => {
    let attempts = 0;
    const value = await retry(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary");
      return "ok";
    }, { delayMs: 0 });
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("times out a pending operation", async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).rejects.toThrow("timed out");
  });

  it("writes and reads JSON files", async () => {
    const root = await mkdtemp(join(tmpdir(), "simple-cronjob-utils-"));
    const path = join(root, "nested", "config.json");
    await writeJson(path, { enabled: true, count: 2 });
    expect(await fileExists(path)).toBe(true);
    await expect(readJson<{ enabled: boolean }>(path)).resolves.toEqual({ enabled: true, count: 2 });
    await rm(root, { recursive: true, force: true });
  });

  it("requests JSON over HTTP", async () => {
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose a port.");
    const result = await requestJson<{ ok: boolean }>(`http://127.0.0.1:${address.port}`);
    expect(result.status).toBe(200);
    expect(result.data.ok).toBe(true);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("reads environment values without exposing secrets", () => {
    process.env.SIMPLE_CRONJOB_TEST = "value";
    expect(getEnv("SIMPLE_CRONJOB_TEST")).toBe("value");
    expect(requireEnv("SIMPLE_CRONJOB_TEST")).toBe("value");
    expect(isWindows()).toBe(process.platform === "win32");
    delete process.env.SIMPLE_CRONJOB_TEST;
  });
});
