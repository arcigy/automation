import { env } from "../core/env";
import { fetchTool } from "../tools/http/fetch.tool";

async function findLeadWithHistory() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";
  const campaignId = 2920707; // GEODETI campaign

  console.log(`🔍 Looking for leads in campaign ${campaignId}...`);
  
  const res = await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/leads?api_key=${apiKey}&limit=20`,
    method: 'GET'
  });

  if (res.status !== 200) {
      console.error("Failed to fetch leads");
      process.exit(1);
  }

  const leads = (res.data as any).data || res.data || [];
  console.log(`✅ Found ${leads.length} leads.`);

  for (const lead of leads) {
      const leadMapId = lead.id || lead.campaign_lead_map_id;
      console.log(`\nChecking lead: ${lead.email} (ID: ${leadMapId})...`);
      
      const historyRes = await fetchTool({
        url: `${baseUrl}/campaigns/${campaignId}/leads/${leadMapId}/message-history?api_key=${apiKey}`,
        method: 'GET'
      });

      const history = (historyRes.data as any).history || historyRes.data || [];
      if (Array.isArray(history) && history.length > 0) {
          console.log(`🔥 FOUND HISTORY for ${lead.email}!`);
          history.forEach((m: any) => {
              console.log(`   - ${m.send_time || m.created_at} | ${m.type} | Subject: ${m.subject}`);
          });
          process.exit(0);
      } else {
          console.log(`   (0 messages)`);
      }
  }

  process.exit(0);
}

findLeadWithHistory().catch(console.error);
