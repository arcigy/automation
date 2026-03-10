import { Redis } from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URL);

export async function cacheGet(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redis.set(key, value, "EX", ttlSeconds);
  } else {
    await redis.set(key, value);
  }
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const result = await redis.exists(key);
  return result > 0;
}
