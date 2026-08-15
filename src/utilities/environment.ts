export function getEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] ?? defaultValue;
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required environment variable "${name}" is missing.`);
  return value;
}

export function isWindows(): boolean {
  return process.platform === "win32";
}
