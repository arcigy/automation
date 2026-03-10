import { Hono } from "hono";
import { ok, err } from "../../core/response";

const trigger = new Hono();

trigger.post("/:automation", async (c) => {
  const name = c.req.param("automation");
  const payload = await c.req.json();

  try {
    // Dynamický import — každá automatizácia sa načíta lazy
    const mod = await import(`../../automations/${name}/handler.ts`);
    const result = await mod.handler(payload);
    return ok(c, result);
  } catch (e: any) {
    if (e.code === "MODULE_NOT_FOUND" || e.code === "ERR_MODULE_NOT_FOUND")
      return err(c, `Automation '${name}' not found`, 404);
    return err(c, e.message, 500);
  }
});

export { trigger as triggerRoutes };
