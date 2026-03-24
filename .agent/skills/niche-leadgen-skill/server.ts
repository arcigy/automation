/**
 * server.ts — HTTP API wrapper for niche-leadgen-skill
 * Wraps all leadgen scripts as REST endpoints for remote Gemini control via Railway
 * All requests authenticated via x-api-key header
 */

import { Bun } from "bun";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const port = parseInt(process.env.PORT || "3000");
const apiKey = process.env.RAILWAY_AUTH_KEY;

if (!apiKey) {
  console.error("❌ RAILWAY_AUTH_KEY environment variable not set");
  process.exit(1);
}

// Middleware: verify API key from x-api-key header
function verifyAuth(request: Request): boolean {
  const headerKey = request.headers.get("x-api-key");
  return headerKey === apiKey;
}

// Helper: run script with args and return output
function runScript(
  scriptName: string,
  args: Record<string, string | number | boolean>
): string {
  const scriptPath = join(import.meta.dir, "scripts", `${scriptName}.ts`);
  const cmdArgs = Object.entries(args)
    .map(([key, val]) => {
      if (val === true) return `--${key}`;
      if (val === false) return "";
      return `--${key} ${val}`;
    })
    .filter(Boolean)
    .join(" ");

  try {
    const result = execSync(`bun ${scriptPath} ${cmdArgs}`, {
      cwd: import.meta.dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result;
  } catch (error: any) {
    throw new Error(`Script execution failed: ${error.message}`);
  }
}

// Health check endpoint
function healthHandler(): Response {
  return Response.json(
    {
      status: "ok",
      service: "niche-leadgen-skill",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

// Status endpoint — DB stats
function statusHandler(request: Request): Response {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const niche = url.searchParams.get("niche");

  try {
    const output = runScript("db-status", niche ? { niche } : {});
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Discovery endpoint — scrape leads
async function discoveryHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { niche, region, source, target, dryRun } = body;

  if (!niche || !region) {
    return Response.json(
      { error: "niche and region are required" },
      { status: 400 }
    );
  }

  try {
    const output = runScript("discovery", {
      niche,
      region,
      ...(source && { source }),
      ...(target && { target }),
      ...(dryRun && { "dry-run": true }),
    });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Enrich endpoint — AI enrichment of leads
async function enrichHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { niche, limit, allPending } = body;

  if (!niche) {
    return Response.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    const output = runScript("enrich", {
      niche,
      ...(limit && { limit }),
      ...(allPending && { "all-pending": true }),
    });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Validate endpoint — validate leads before injection
async function validateHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { niche } = body;

  if (!niche) {
    return Response.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    const output = runScript("validate", { niche });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Inject endpoint — inject into Smartlead
async function injectHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { niche, minScore, createCampaign, dryRun } = body;

  if (!niche) {
    return Response.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    const output = runScript("inject", {
      niche,
      ...(minScore && { "min-score": minScore }),
      ...(createCampaign && { "create-campaign": true }),
      ...(dryRun && { "dry-run": true }),
    });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Prep for AI endpoint — return markdown with leads
async function prepForAiHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { niche } = body;

  if (!niche) {
    return Response.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    const output = runScript("prep-for-ai", { niche });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Write icebreakers endpoint
async function writeIcebreakersHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { icebreakers } = body;

  if (!Array.isArray(icebreakers)) {
    return Response.json(
      { error: "icebreakers array is required" },
      { status: 400 }
    );
  }

  try {
    // Write icebreakers to temp file and call script
    const output = runScript("write-icebreakers", {
      input: JSON.stringify(icebreakers),
    });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Export endpoint — export leads
function exportHandler(request: Request): Response {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const niche = url.searchParams.get("niche");

  if (!niche) {
    return Response.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    const output = runScript("export", { niche });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Blacklist endpoint
async function blacklistHandler(request: Request): Promise<Response> {
  if (!verifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, domain } = body;

  if (!action || !["add", "remove", "list"].includes(action)) {
    return Response.json(
      { error: "action must be add/remove/list" },
      { status: 400 }
    );
  }

  if (action !== "list" && !domain) {
    return Response.json({ error: "domain is required for add/remove" }, { status: 400 });
  }

  try {
    const output = runScript("blacklist", {
      action,
      ...(domain && { domain }),
    });
    return Response.json({ status: "ok", data: output }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Router
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Health check (no auth required)
  if (pathname === "/health" && method === "GET") {
    return healthHandler();
  }

  // All other routes require auth
  if (pathname === "/status" && method === "GET") {
    return statusHandler(request);
  }
  if (pathname === "/discovery" && method === "POST") {
    return await discoveryHandler(request);
  }
  if (pathname === "/enrich" && method === "POST") {
    return await enrichHandler(request);
  }
  if (pathname === "/validate" && method === "POST") {
    return await validateHandler(request);
  }
  if (pathname === "/inject" && method === "POST") {
    return await injectHandler(request);
  }
  if (pathname === "/prep-for-ai" && method === "POST") {
    return await prepForAiHandler(request);
  }
  if (pathname === "/write-icebreakers" && method === "POST") {
    return await writeIcebreakersHandler(request);
  }
  if (pathname === "/export" && method === "GET") {
    return exportHandler(request);
  }
  if (pathname === "/blacklist" && method === "POST") {
    return await blacklistHandler(request);
  }

  // 404
  return Response.json({ error: "Not found" }, { status: 404 });
}

const server = Bun.serve({
  port,
  fetch: handler,
  hostname: "0.0.0.0",
});

console.log(`✅ Niche Leadgen API running on http://localhost:${port}`);
console.log(`📝 API Key required in x-api-key header`);
console.log(`🚀 Health check: GET /health`);
