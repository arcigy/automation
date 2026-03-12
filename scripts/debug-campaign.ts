import { fetchTool } from "../tools/http/fetch.tool";
import { env } from "../core/env";

async function c() {
  const r = await fetchTool({ url: 'https://server.smartlead.ai/api/v1/campaigns?api_key=' + env.SMARTLEAD_API_KEY });
  if (r.data && Array.isArray(r.data)) {
    const c = r.data[0];
    console.log("Campaign Fields:", Object.keys(c));
    if (c.stats) console.log("Stats:", c.stats);
  }
  process.exit(0);
}
c();
