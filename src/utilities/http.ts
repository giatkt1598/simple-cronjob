export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | object;
  timeoutMs?: number;
  expectedStatus?: number[];
}

export interface HttpResponse<T> {
  status: number;
  headers: Headers;
  data: T;
}

export async function requestText(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<string>> {
  const response = await request(url, options);
  return { status: response.status, headers: response.headers, data: await response.text() };
}

export async function requestJson<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
  const response = await request(url, options);
  return { status: response.status, headers: response.headers, data: await response.json() as T };
}

async function request(url: string, options: HttpRequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
  const body = typeof options.body === "object" && options.body !== null ? JSON.stringify(options.body) : options.body;
  const headers = { ...(body && typeof options.body === "object" ? { "content-type": "application/json" } : {}), ...options.headers };
  try {
    const response = await fetch(url, { method: options.method ?? "GET", headers, body, signal: controller.signal });
    const expected = options.expectedStatus ?? [200, 201, 202, 204];
    if (!expected.includes(response.status)) throw new Error(`HTTP ${response.status} for ${url}.`);
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
