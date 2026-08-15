import { CronJob } from "../core/decorator.js";
import type { CronJobContext, CronJobHandler } from "../core/types.js";
import { runCommand } from "../utilities/index.js";

@CronJob({
  description: "Run giatk -v every five minutes.",
  schedule: "*/5 * * * *",
})
export class GiatkVersionJob implements CronJobHandler {
  async execute(context: CronJobContext): Promise<void> {
    const result = await runCommand("giatk -v", { cwd: context.projectRoot });
    const output = result.stdout.trim();
    const errorOutput = result.stderr.trim();

    if (result.code !== 0) {
      context.logger.error(
        "giatk -v failed",
        new Error(errorOutput || output || `giatk exited with code ${result.code}`),
        { Command: "giatk -v", ExitCode: result.code },
      );
      throw new Error(`giatk -v exited with code ${result.code}.`);
    }

    context.logger.info("giatk -v completed", {
      Command: "giatk -v",
      ExitCode: result.code,
      Output: output,
    });
  }
}
