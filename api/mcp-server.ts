import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Hono } from "hono";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

/**
 * MCP Server for Lead Generation (SSE Implementation)
 * Hosted on Railway to be accessible from Cloud Claude via bridge.
 */
export function setupMcpServer(app: Hono) {
  const mcpServer = new Server(
    {
      name: "Arcigy LeadGen",
      version: "2.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // --- Define Tools ---
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "run_leadgen_pipeline",
        description: "Starts a fully automated lead generation campaign: Discovery (Serper) -> Enrichment (Playwright) -> Smartlead Injection (AI).",
        inputSchema: {
          type: "object",
          properties: {
            niche: { type: "string", description: "Internal slug (e.g. 'fasady')" },
            query: { type: "string", description: "Search query for Serper (e.g. 'dodavatelia odvetravanych fasad')" },
            region: { type: "string", description: "City or 'all-slovakia'", default: "all-slovakia" },
            target: { type: "number", description: "Lead limit", default: 100 },
            create_campaign: { type: "boolean", description: "Create results in Smartlead automatically", default: true }
          },
          required: ["niche", "query"]
        }
      }
    ]
  }));

  // --- Tool Logic ---
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "run_leadgen_pipeline") {
      const { niche, query, region = "all-slovakia", target = 100, create_campaign = true } = args as any;
      console.log(`🚀 [MCP] Triggering LeadGen: ${niche}`);

      const scriptPath = join(PROJECT_ROOT, ".agent", "skills", "niche-leadgen-skill", "scripts", "full-pipeline.ts");
      const cmdArgs = [
        "node", "--env-file", ".env", "--import", "tsx", scriptPath,
        "--niche", niche,
        "--query", query,
        "--region", region,
        "--target", target.toString(),
        create_campaign ? "--create-campaign" : ""
      ].filter(Boolean);

      // Start on background
      spawn(cmdArgs[0], cmdArgs.slice(1), {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: "ignore",
      }).unref();

      return {
        content: [{ type: "text", text: `Pipeline pre "${niche}" bola úspešne spustená na pozadí ✅. Dáta sleduj v Smartleade.` }]
      };
    }
    throw new Error(`Tool "${name}" not found.`);
  });

  // --- Transport handling (SSE) ---
  let transport: SSEServerTransport | null = null;

  app.get("/mcp/sse", async (c) => {
    console.log("🔗 MCP Client connected to SSE endpoint");
    transport = new SSEServerTransport("/mcp/messages", c.res as any);
    await mcpServer.connect(transport);
    return c.body(null);
  });

  app.post("/mcp/messages", async (c) => {
    if (transport) {
      await transport.handlePostMessage(c.req.raw as any, c.res as any);
      return c.body(null, 204);
    }
    return c.json({ error: "No active connection" }, 400);
  });
}
