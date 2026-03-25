import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Hono } from "hono";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

export function setupMcpServer(app: Hono) {
  const mcpServer = new Server(
    {
      name: "Arcigy LeadGen",
      version: "2.2.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "run_leadgen_pipeline",
        description: "Starts a fully automated lead generation campaign: Discovery -> Enrichment -> Smartlead Injection.",
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
      const cmdArgs = ["node", "--env-file", ".env", "--import", "tsx", scriptPath, "--niche", niche, "--query", query, "--region", region, "--target", target.toString(), create_campaign ? "--create-campaign" : ""].filter(Boolean);
      spawn(cmdArgs[0], cmdArgs.slice(1), { cwd: PROJECT_ROOT, detached: true, stdio: "ignore" }).unref();
      return { content: [{ type: "text", text: `Pipeline pre "${niche}" spustená na pozadí ✅.` }] };
    }
    throw new Error(`Tool "${name}" not found.`);
  });

  let transport: SSEServerTransport | null = null;

  app.get("/mcp/sse", async (c) => {
    console.log("🔗 MCP: Client connected to SSE");
    
    // V @hono/node-server môžeme získať raw Node objects takto:
    const nodeRes = (c.env as any).outgoing || (c as any).res.raw || (c.req.raw as any).res;
    
    // Ak to stále nefunguje, skúsime manuálny SSE stream cez Hono
    // Ale skúsme najprv správny transport:
    transport = new SSEServerTransport("/mcp/messages", nodeRes);
    await mcpServer.connect(transport);
    
    // Povieme Honu, že odpoveď už rieši transport
    return new Response(null, { status: 101 });
  });

  app.post("/mcp/messages", async (c) => {
    if (transport) {
      const nodeRes = (c.env as any).outgoing || (c as any).res.raw || (c.req.raw as any).res;
      await transport.handlePostMessage(c.req.raw as any, nodeRes);
      return new Response(null, { status: 204 });
    }
    return c.json({ error: "No active connection" }, 400);
  });
}
