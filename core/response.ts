import type { Context } from "hono";

export const ok = (c: Context, data: unknown) =>
  c.json({ success: true, data }, 200);

export const err = (c: Context, message: string, status = 400) =>
  c.json({ success: false, error: message }, status as any);
