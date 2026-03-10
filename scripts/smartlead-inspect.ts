import { env } from '../core/env';
import { fetchTool } from '../tools/http/fetch.tool';

async function main() {
  const apiKey = env.SMARTLEAD_API_KEY;
  if (!apiKey) {
    console.error("❌ SMARTLEAD_API_KEY is not set in environment.");
    process.exit(1);
  }

  const baseUrl = "https://server.smartlead.ai/api/v1";
  const leadMapId = '2751768200';

  console.log(`\n=== Fetching Lead Master Inbox by Map ID: ${leadMapId} ===`);
  const result = await fetchTool({
    url: `${baseUrl}/master-inbox/lead/${leadMapId}?api_key=${apiKey}`,
    method: 'GET',
    timeoutMs: 30000
  });

  if (result.status !== 200 || typeof result.data === 'string') {
      console.error(`Failed to fetch lead structure: ${result.status}`);
      process.exit(1);
  }

  console.log('Lead detail raw:');
  console.log(JSON.stringify(result.data, null, 2));

  const data = result.data as any;
  if (data?.email_history && data.email_history.length > 0) {
     console.log("\n=== 4. Test Payload JSON (dry-run) ===");
     
     const history = data.email_history;
     const leadEmail = data.to_email || "test@test.com";

     const replyMessages = history.filter((m: any) => 
       m.type === 'EMAIL_REPLY' || 
       m.type === 'REPLY' || 
       (m.from_email && m.from_email.includes(leadEmail))
     );
     
     let finalEmailBody = "Hey, this looks interesting!";
     if (replyMessages.length > 0) {
       const lastReply = replyMessages[replyMessages.length - 1];
       if (lastReply.email_body) {
         finalEmailBody = lastReply.email_body.replace(/\n\s*\n/g, '\n').trim();
       }
     }

     const testPayload = {
       to_email: leadEmail,
       from_email: "tvoj@email.com",
       lead_name: data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : "Lead z Inboxu",
       campaign_id: String(data.campaign_id || "2967878"),
       campaign_name: data.campaign_name || "Vybrata Kampaň",
       category_name: "Interested",
       email_body: finalEmailBody,
       type: "LEAD_CATEGORY_UPDATED",
       dry_run: true
     };

     console.log(JSON.stringify(testPayload, null, 2));
  }
}

main().catch(console.error);
