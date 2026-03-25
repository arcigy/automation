import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, JSONRPCResponse, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

export function setupMcpServer(app: Hono) {
  const mcpServer = new Server(
    { name: "Arcigy LeadGen", version: "2.4.0" },
    { capabilities: { tools: {} } }
  );

  // --- TOOLS DEFINITION ---
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "run_leadgen_pipeline",
        description: "Starts a fully automated lead generation campaign: Discovery (Serper) -> Enrichment (Playwright) -> Smartlead Injection.",
        inputSchema: {
          type: "object",
          properties: {
            niche: { type: "string" },
            query: { type: "string" },
            region: { type: "string", default: "all-slovakia" },
            target: { type: "number", default: 100 },
            create_campaign: { type: "boolean", default: true }
          },
          required: ["niche", "query"]
        }
      }
    ]
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "run_leadgen_pipeline") {
       const { niche, query, region = "all-slovakia", target = 100, create_campaign = true } = args as any;
       const scriptPath = join(PROJECT_ROOT, ".agent", "skills", "niche-leadgen-skill", "scripts", "full-pipeline.ts");
       const cmdArgs = ["node", "--env-file", ".env", "--import", "tsx", scriptPath, "--niche", niche, "--query", query, "--region", region, "--target", target.toString(), create_campaign ? "--create-campaign" : "--skip-inject"].filter(Boolean);
       spawn(cmdArgs[0], cmdArgs.slice(1), { cwd: PROJECT_ROOT, detached: true, stdio: "ignore" }).unref();
       return { content: [{ type: "text", text: `Pipeline pre "${niche}" úspešne beží na pozadí 🚀.` }] };
    }
    throw new Error(`Tool "${name}" not found.`);
  });

  // --- SSE SESSIONS ---
  const sessions = new Map<string, any>();

  app.get("/mcp/sse", (c) => {
    const sessionId = Math.random().toString(36).slice(2);
    console.log(`🔗 [MCP] Client connected: ${sessionId}`);

    return streamSSE(c, async (stream) => {
      // 1. Send endpoint for POST messages
      await stream.writeSSE({
        event: "endpoint",
        data: `/mcp/messages?sessionId=${sessionId}`
      });

      // 2. Register stream callback
      sessions.set(sessionId, stream);

      // Heartbeat
      const interval = setInterval(() => stream.writeSSE({ event: "ping", data: "heartbeat" }), 15000);

      stream.onAbort(() => {
        clearInterval(interval);
        sessions.delete(sessionId);
        console.log(`❌ [MCP] Client disconnected: ${sessionId}`);
      });

      // Keep connection open
      while (sessions.has(sessionId)) {
        await new Promise(r => setTimeout(r, 1000));
      }
    });
  });

  app.post("/mcp/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    const stream = sessions.get(sessionId || "");
    if (!stream) return c.json({ error: "Session missing" }, 404);

    const message = await c.req.json();
    
    // Process message through Server
    // Server doesn't have a single .onmessage that returns JSONRPCResponse easily if it's SSE-style.
    // However, we can use a "bridge" approach:
    
    try {
      // For MCP 1.0, we just need to return the response
      // We'll mimic the SSE response by writing it back to the stream
      const response = await mcpServer.onmessage(message as JSONRPCMessage);
      
      if (response && stream) {
        await stream.writeSSE({ data: JSON.stringify(response) });
      }
    } catch (e: any) {
      console.error(`MCP Error: ${e.message}`);
    }

    return c.body(null, 204);
  });
}
