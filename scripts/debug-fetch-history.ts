import { env } from "../core/env";
import { fetchTool } from "../tools/http/fetch.tool";

async function testFetchHistory() {
  const email = "laubert.bb@gmail.com";
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  console.log(`🔍 Hľadám leada: ${email}...`);
  
  // 1. Nájdeme leada podľa emailu
  const leadLookupRes = await fetchTool({
    url: `${baseUrl}/leads/?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
    method: 'GET'
  });

  if (leadLookupRes.status !== 200) {
    console.error(`❌ Chyba pri hľadaní leada: ${leadLookupRes.status}`, leadLookupRes.data);
    process.exit(1);
  }

  const leads = Array.isArray(leadLookupRes.data) ? leadLookupRes.data : [leadLookupRes.data];
  
  if (leads.length === 0 || !leads[0]) {
    console.log("❌ Lead nenájdený v Smartleade.");
    process.exit(0);
  }

  console.log(`✅ Nájdených ${leads.length} záznamov.`);
  console.log("RAW DATA:", JSON.stringify(leads[0], null, 2));

  for (const lead of leads) {
      if (!lead.lead_campaign_data || lead.lead_campaign_data.length === 0) {
          console.log(`⚠️ Lead ${lead.email} nemá žiadne kampane.`);
          continue;
      }

      for (const camp of lead.lead_campaign_data) {
          const campaignId = camp.campaign_id;
          const leadMapId = camp.campaign_lead_map_id;
          const campaignName = camp.campaign_name;
          
          console.log(`\n--------------------------------------------`);
          console.log(`📁 Kampaň: ${campaignName} (ID: ${campaignId})`);
          console.log(`🆔 Lead Map ID: ${leadMapId}`);
          
          console.log(`📡 Sťahujem históriu správ...`);
          
          const historyRes = await fetchTool({
            url: `${baseUrl}/campaigns/${campaignId}/leads/${leadMapId}/message-history?api_key=${apiKey}`,
            method: 'GET'
          });

      if (historyRes.status === 200) {
          const history = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data as any).history || [];
          console.log(`📩 Nájdených ${history.length} správ:`);
          
          history.forEach((m: any, i: number) => {
              const type = m.type || (m.from_email === email ? 'REPLY' : 'SENT');
              console.log(`   [${i+1}] ${m.send_time || m.created_at} | ${type}`);
              console.log(`       Od: ${m.from_email}`);
              console.log(`       Predmet: ${m.subject || 'N/A'}`);
              const bodySnippet = (m.email_body || '').replace(/<[^>]*>/g, ' ').substring(0, 100);
              console.log(`       Text: ${bodySnippet}...`);
          });
      } else {
          console.error(`❌ Nepodarilo sa stiahnuť históriu pre túto kampaň.`);
      }
    }
  }

  process.exit(0);
}

testFetchHistory().catch(console.error);
