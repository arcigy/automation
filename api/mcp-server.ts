import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

/**
 * MCP Server for Lead Generation (Native Hono SSE Implementation)
 * Zabezpečuje 100% stabilitu na Railway a kompatibilitu s Claude.ai Cloud Connector.
 */
export function setupMcpServer(app: Hono) {
  const mcpServer = new Server(
    { name: "Arcigy LeadGen Engine", version: "3.0.0" },
    { capabilities: { tools: {} } }
  );

  // --- REGISTRÁCIA TOOLOV ---
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "run_leadgen_pipeline",
        description: "Spustí komplexný Lead Generation automat (Serper -> Scraper -> AI Enricher -> Smartlead).",
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

  // --- LOGIKA VOLANIA ---
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "run_leadgen_pipeline") {
      const { niche, query, region = "all-slovakia", target = 100, create_campaign = true } = args as any;
      const scriptPath = join(PROJECT_ROOT, ".agent", "skills", "niche-leadgen-skill", "scripts", "full-pipeline.ts");
      const cmdArgs = ["node", "--env-file", ".env", "--import", "tsx", scriptPath, "--niche", niche, "--query", query, "--region", region, "--target", target.toString(), create_campaign ? "--create-campaign" : "--skip-inject"].filter(Boolean);
      
      spawn(cmdArgs[0], cmdArgs.slice(1), { cwd: PROJECT_ROOT, detached: true, stdio: "ignore" }).unref();
      return { content: [{ type: "text", text: `Pipeline pre "${niche}" spustená na pozadí 🚀.` }] };
    }
    throw new Error(`Tool "${name}" not found.`);
  });

  // --- SSE SESSION MANAGEMENT (Bez 101 status kódu) ---
  const activeClients = new Map<string, any>();

  // 1. SSE Connection (GET)
  app.get("/mcp/sse", (c) => {
    const sessionId = Math.random().toString(36).slice(2);
    console.log(`📡 [MCP] Napojený nový Claude klient (Session: ${sessionId})`);

    return streamSSE(c, async (stream) => {
      // Zapíšeme URL kam má Claude posielať POST správy
      await stream.writeSSE({
        event: "endpoint",
        data: `/mcp/messages?sessionId=${sessionId}`
      });

      // Uložíme si stream na posielanie odpovedí
      activeClients.set(sessionId, stream);

      // Heartbeat interval (životne dôležité na Railway aby nestopol connection)
      const heartbeat = setInterval(() => {
        try {
          stream.writeSSE({ event: "ping", data: "heartbeat" });
        } catch {
          clearInterval(heartbeat);
          activeClients.delete(sessionId);
        }
      }, 20000);

      stream.onAbort(() => {
        clearInterval(heartbeat);
        activeClients.delete(sessionId);
        console.log(`🔌 [MCP] Claude klient sa odpojil (Session: ${sessionId})`);
      });

      // Udržujeme stream nažive
      while (activeClients.has(sessionId)) {
        await new Promise(r => setTimeout(r, 1000));
      }
    });
  });

  // 2. Message Exchange (POST)
  app.post("/mcp/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    const stream = activeClients.get(sessionId || "");
    if (!stream) return c.json({ error: "Session missing or expired" }, 404);

    try {
      const message = await c.req.json() as JSONRPCMessage;
      
      // Spracovanie cez MCP Server
      const result = await mcpServer.onmessage(message);
      
      if (result) {
        // Výsledok pošleme späť cez ten istý SSE stream (toto je ten magic)
        await stream.writeSSE({ data: JSON.stringify(result) });
      }
      
      return c.body(null, 204);
    } catch (e: any) {
      console.error(`❌ [MCP] Message error: ${e.message}`);
      return c.json({ error: e.message }, 500);
    }
  });
}

/**
 * Poznámka: Tento súbor musí byť importovaný v api/server.ts 
 * a musí tam byť zavolaný setupMcpServer(app).
 */
