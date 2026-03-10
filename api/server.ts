import { Hono } from "hono";
import { webhookRoutes } from "./routes/webhook";
import { triggerRoutes } from "./routes/trigger";
import { authMiddleware } from "./middleware/auth";
import { requestLogger } from "./middleware/logger";
import { runMigrations } from "../core/db";

const app = new Hono();

// Spustiť migrácie nezávisle pri štarte
runMigrations().catch(e => console.error("Migration error:", e));

app.use("*", requestLogger);
app.use("/trigger/*", authMiddleware); // trigger vždy chránený
app.use("/webhook/*", authMiddleware); // webhook voliteľne

app.route("/webhook", webhookRoutes);
app.route("/trigger", triggerRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

export default { port: process.env.PORT ?? 3000, fetch: app.fetch };
