export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export async function retry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 1_000;
  const multiplier = options.backoffMultiplier ?? 2;
  const maxDelayMs = options.maxDelayMs ?? Number.POSITIVE_INFINITY;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("retry maxAttempts must be at least 1.");

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || options.shouldRetry?.(error, attempt) === false) throw error;
      const delay = Math.min(maxDelayMs, delayMs * multiplier ** (attempt - 1));
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message = `Operation timed out after ${timeoutMs}ms.`): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be greater than 0.");
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
