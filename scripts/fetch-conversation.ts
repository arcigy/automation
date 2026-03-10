import { env } from '../core/env';
import { fetchTool } from '../tools/http/fetch.tool';

async function fetchConversation(campaignId: string, leadEmail: string) {
  const baseUrl = 'https://server.smartlead.ai/api/v1';

  console.log(`=== Vyhľadávam leada: ${leadEmail} ===`);
  
  // 1. Nájsť lead_id
  const leadLookupRes = await fetchTool({
    url: `${baseUrl}/leads/?api_key=${env.SMARTLEAD_API_KEY}&email=${encodeURIComponent(leadEmail)}`,
    method: 'GET'
  });

  if (leadLookupRes.status !== 200) {
    console.error('Chyba pri hľadaní leada:', leadLookupRes.data);
    return;
  }

  const leads = leadLookupRes.data as any[];
  if (!leads || leads.length === 0) {
    console.error('Lead nebol nájdený.');
    return;
  }

  const targetLead = leads.find(l => l.campaign_id == campaignId) || leads[0];
  const leadMapId = targetLead.id || targetLead.campaign_lead_map_id;

  console.log(`Lead ID: ${leadMapId} (Kampan ID: ${targetLead.campaign_id})`);

  // 2. Fetchnúť históriu
  console.log(`\n=== Sťahujem celú konverzáciu ===`);
  const historyRes = await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/leads/${leadMapId}/message-history?api_key=${env.SMARTLEAD_API_KEY}`,
    method: 'GET'
  });

  if (historyRes.status !== 200) {
    console.error('Chyba pri sťahovaní histórie:', historyRes.data);
    return;
  }

  const history = (historyRes.data as any).history || (historyRes.data as any);
  
  if (!Array.isArray(history)) {
    console.log('Žiadna história nenájdená:', history);
    return;
  }

  // Zoradenie podľa času (od najstaršej po najnovšiu)
  const sorted = history.sort((a, b) => 
    new Date(a.send_time || a.created_at).getTime() - new Date(b.send_time || b.created_at).getTime()
  );

  console.log(`Nájdených správ: ${sorted.length}\n`);

  sorted.forEach((msg, i) => {
    const isReply = msg.type === 'EMAIL_REPLY' || msg.type === 'REPLY';
    const sender = isReply ? 'LEAD' : 'TY';
    const date = new Date(msg.send_time || msg.created_at).toLocaleString('sk-SK');
    
    console.log(`[${i + 1}] ${date} - SENDER: ${sender}`);
    console.log(`SUBJECT: ${msg.subject}`);
    console.log(`BODY (clean): ${msg.email_body.replace(/<[^>]*>/g, '').substring(0, 300)}...`);
    console.log('-'.repeat(50));
  });
}

// Spustenie pre Janku
fetchConversation('2967878', 'batkova.janka@gmail.com');
