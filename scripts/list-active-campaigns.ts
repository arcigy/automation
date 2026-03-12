import { env } from "../core/env";
import { fetchTool } from "../tools/http/fetch.tool";

async function findActiveCampaign() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  console.log("🔍 Fetching all campaigns...");
  const res = await fetchTool({
    url: `${baseUrl}/campaigns?api_key=${apiKey}`,
    method: 'GET'
  });

  if (Array.isArray(res.data)) {
      const active = res.data.filter((c: any) => c.total_sent_count > 0);
      console.log(`✅ Found ${active.length} campaigns with sent emails.`);
      active.forEach((c: any) => {
          console.log(`- ${c.name} (ID: ${c.id}) | Sent: ${c.total_sent_count} | Unique Replied: ${c.unique_replied_count}`);
      });
  }
  process.exit(0);
}

findActiveCampaign().catch(console.error);
