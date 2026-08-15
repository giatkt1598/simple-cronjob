import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  splitting: false,
  platform: "node",
  format: "esm",
  target: "node18",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});

await copyFile("scripts/run-job.vbs", "dist/run-job.vbs");

await build({
  entryPoints: ["src/cronjobs/*.cronjob.ts"],
  outdir: "dist/cronjobs",
  bundle: true,
  splitting: false,
  platform: "node",
  format: "esm",
  target: "node18",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});
