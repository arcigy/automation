import axios from "axios";

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

function shouldUseProxyFromEnv(): boolean {
  const v = (process.env.ARCIGY_FETCH_USE_PROXY ?? "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

export async function fetchTool(
  input: FetchToolInput,
): Promise<FetchToolOutput> {
  const res = await axios.request({
    url: input.url,
    method: input.method ?? "GET",
    headers: { "Content-Type": "application/json", ...input.headers },
    data: input.body,
    timeout: input.timeoutMs ?? 30000,
    validateStatus: () => true,
    proxy: shouldUseProxyFromEnv() ? undefined : false,
  });

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.headers ?? {})) {
    headers[k] = Array.isArray(v) ? v.join(",") : String(v);
  }

  return {
    status: res.status,
    data: res.data,
    headers,
  };
}
