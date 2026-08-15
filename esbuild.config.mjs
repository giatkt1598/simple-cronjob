import { build } from "esbuild";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

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
  sourcemap: false,
  logLevel: "info",
});

await copyFile("scripts/run-job.vbs", "dist/run-job.vbs");

const cronJobEntryPoints = await findCronJobFiles("src/cronjobs");

await build({
  entryPoints: cronJobEntryPoints,
  outdir: "dist/cronjobs",
  outbase: "src/cronjobs",
  bundle: true,
  splitting: false,
  platform: "node",
  format: "esm",
  target: "node18",
  packages: "external",
  sourcemap: false,
  logLevel: "info",
});

async function findCronJobFiles(directory, relativeDirectory = "") {
  const currentDirectory = join(directory, relativeDirectory);
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findCronJobFiles(directory, relativePath));
    } else if (entry.isFile() && /\.cronjob\.ts$/u.test(entry.name)) {
      files.push(join(directory, relativePath));
    }
  }
  return files;
}
