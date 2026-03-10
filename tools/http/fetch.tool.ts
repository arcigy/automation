export interface FetchToolInput {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface FetchToolOutput {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

export async function fetchTool(
  input: FetchToolInput,
): Promise<FetchToolOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 30000,
  );

  try {
    const res = await fetch(input.url, {
      method: input.method ?? "GET",
      headers: { "Content-Type": "application/json", ...input.headers },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return {
      status: res.status,
      data,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } finally {
    clearTimeout(timeout);
  }
}
