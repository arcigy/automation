import { env } from "../../core/env";
import { fetchTool } from "../http/fetch.tool";

export interface SerperSearchInput {
  query: string;
  limit?: number;
  location?: string;
}

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  website: string;
}

export async function serperSearchTool(input: SerperSearchInput): Promise<SerperResult[]> {
  const apiKey = env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not found in environment");

  const res = await fetchTool({
    url: "https://google.serper.dev/search",
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: {
      q: input.query,
      num: input.limit || 10,
      gl: "sk" // Default to Slovakia
    }
  });

  const organic = (res.data as any).organic || [];
  
  return organic.map((item: any) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
    website: new URL(item.link).hostname
  }));
}
