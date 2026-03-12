import { fetchTool } from "../tools/http/fetch.tool";
import { env } from "../core/env";

// Delete the failed campaign 3026233 and start fresh
async function main() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  const res = await fetchTool({
    url: `${baseUrl}/campaigns/3026233?api_key=${apiKey}`,
    method: "DELETE"
  });
  console.log(`Delete status: ${res.status}`, res.data);
  process.exit(0);
}

main().catch(console.error);
