import { cacheGet, cacheSet, cacheDel, cacheExists } from "../../core/redis";

export interface CacheToolInput {
  operation: "get" | "set" | "del" | "exists";
  key: string;
  value?: string;
  ttlSeconds?: number;
}

export interface CacheToolOutput {
  result: string | null | boolean;
}

export async function cacheTool(input: CacheToolInput): Promise<CacheToolOutput> {
  switch (input.operation) {
    case "get":
      return { result: await cacheGet(input.key) };
    case "set":
      if (input.value === undefined) {
        throw new Error("value is required for 'set' operation");
      }
      await cacheSet(input.key, input.value, input.ttlSeconds);
      return { result: true };
    case "del":
      await cacheDel(input.key);
      return { result: true };
    case "exists":
      return { result: await cacheExists(input.key) };
    default:
      throw new Error(`Unsupported operation: ${input.operation}`);
  }
}
