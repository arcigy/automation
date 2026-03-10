import type { MiddlewareHandler } from "hono";
import { env } from "../../core/env";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const key = c.req.header("x-api-key");
  if (key !== env.API_SECRET_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
