import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { webhookRoutes } from "./routes/webhook";
import { triggerRoutes } from "./routes/trigger";
import { authRoutes } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { slackRoutes } from "./routes/slack";
import { crmRoutes } from "./routes/crm";
import { serveStatic } from "@hono/node-server/serve-static";
import { requestLogger } from "./middleware/logger";
import { runMigrations } from "../core/db";
import { initCrons } from "./crons";

const app = new Hono();

// Inicializovať úlohy a migrácie
runMigrations().catch(e => console.error("Migration error:", e));
initCrons();

app.use("*", requestLogger);
app.use("/trigger/*", authMiddleware); // trigger vždy chránený
app.use("/webhook/*", authMiddleware); // webhook voliteľne

app.route("/webhook", webhookRoutes);
app.route("/trigger", triggerRoutes);
app.route("/auth", authRoutes);
app.route("/api/slack", slackRoutes);
app.route("/api/crm", crmRoutes);

// Servovať frontend
app.use("/dashboard/*", serveStatic({ root: "./public" }));
app.get("/", (c) => c.redirect("/dashboard/index.html"));

app.get("/health", (c) => c.json({ status: "ok" }));


const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0'
});
