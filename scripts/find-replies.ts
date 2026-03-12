import { env } from "../core/env";
import { fetchTool } from "../tools/http/fetch.tool";

async function findRepliedLeads() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  const res = await fetchTool({
    url: `${baseUrl}/campaigns?api_key=${apiKey}`,
    method: 'GET'
  });

  if (Array.isArray(res.data)) {
      for (const campaign of res.data) {
          if (campaign.unique_replied_count > 0) {
              console.log(`🎯 Campaign ${campaign.name} (ID: ${campaign.id}) has ${campaign.unique_replied_count} replies!`);
              
              const leadsRes = await fetchTool({
                url: `${baseUrl}/campaigns/${campaign.id}/leads?api_key=${apiKey}&limit=100`,
                method: 'GET'
              });
              
              const leads = (leadsRes.data as any).data || leadsRes.data || [];
              const replied = leads.filter((l: any) => l.replied);
              
              for (const l of replied) {
                  console.log(`   - Replied Lead: ${l.email} (ID: ${l.id})`);
              }
          }
      }
  }
  process.exit(0);
}

findRepliedLeads().catch(console.error);
