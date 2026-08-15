import shell, { type ExecOptions } from "shelljs";

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  silent?: boolean;
}

export interface CommandResult {
  command: string;
  code: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(command: string, options: RunCommandOptions = {}): Promise<CommandResult> {
  const execOptions: ExecOptions & { async: false } = {
    async: false,
    cwd: options.cwd ?? process.cwd(),
    silent: options.silent ?? true,
  };
  if (options.env !== undefined) execOptions.env = options.env;
  if (options.timeoutMs !== undefined) execOptions.timeout = options.timeoutMs;
  const result = shell.exec(command, {
    ...execOptions,
  });
  return {
    command,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function assertCommandSuccess(result: CommandResult): CommandResult {
  if (result.code !== 0) {
    throw new Error(`${result.command} exited with code ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result;
}
