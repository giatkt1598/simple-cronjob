export interface HealthCheckConfig {
  url: string;
  timeoutMs: number;
  expectedStatuses: number[];
}

export interface HealthCheckResult {
  status: number;
  body: string;
}

/** Performs a bounded HTTP health check against a service endpoint. */
export class HealthCheckService {
  constructor(private readonly config: HealthCheckConfig) {}

  /** Calls the endpoint and throws when it cannot be reached or returns an unexpected status. */
  async check(): Promise<HealthCheckResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(this.config.url, { signal: controller.signal });
      const body = await response.text();
      if (!this.config.expectedStatuses.includes(response.status)) {
        throw new Error(`Health check returned HTTP ${response.status} for ${this.config.url}.`);
      }
      return { status: response.status, body };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Health check timed out after ${this.config.timeoutMs}ms for ${this.config.url}.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
