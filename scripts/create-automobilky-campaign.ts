import { sql } from "../core/db";
import { fetchTool } from "../tools/http/fetch.tool";
import { env } from "../core/env";
import { smartleadGenerateSequencesTool } from "../tools/smartlead/generate-sequences.tool";

async function createAutomobilkyCampaign() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  // 1. Cleanup old Automobilky campaigns
  console.log("🧹 Mažem staré 'Automobilky' kampane...");
  const listRes = await fetchTool({ url: `${baseUrl}/campaigns?api_key=${apiKey}` });
  if (Array.isArray(listRes.data)) {
    const toDelete = listRes.data.filter((c: any) => c.name.toLowerCase().includes("automobilky") || c.name.toLowerCase().includes("ai test"));
    for (const c of toDelete) {
      console.log(`  - Mažem "${c.name}" (ID: ${c.id})...`);
      await fetchTool({ url: `${baseUrl}/campaigns/${c.id}?api_key=${apiKey}`, method: "DELETE" });
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 2. Generate AI Sequences from prompt
  console.log("\n🤖 Generujem AI sekvencie pre niche 'Autoservisy'...");
  const aiSequences = await smartleadGenerateSequencesTool({
    nicheName: "Autoservisy",
    nicheDescription: "Majitelia a manažéri autoservisov, pneuservisov a autobazárov na Slovensku. Riešia veľa telefonátov, manuálne objednávky, zákazníci pýtajú ceny cez SMS/WhatsApp.",
    customInstructions: "Namiesto 'obhliadok' použi 'opráv/servisov', namiesto 'záujemcov z Bazoša' použi 'zákazníkov čo volajú a len sa pýtajú na ceny'. Použi sloveso 'servisovať' kde dáva zmysel."
  });
  console.log(`✅ Vygenerovaných ${aiSequences.length} krokov sekvencie.`);

  // 3. Load leads from DB
  console.log("\n📋 Načítavam kompletné leady z DB...");
  const dbLeads = await sql`
    SELECT 
      id, website, primary_email as email,
      decision_maker_name, decision_maker_last_name,
      official_company_name, icebreaker_sentence, ico
    FROM leads
    WHERE primary_email IS NOT NULL AND primary_email != ''
      AND decision_maker_name IS NOT NULL AND decision_maker_name != ''
      AND icebreaker_sentence IS NOT NULL AND LENGTH(icebreaker_sentence) > 20
    ORDER BY created_at ASC
  `;
  console.log(`✅ Nájdených ${dbLeads.length} kompletných leadov.`);

  // 4. Build lead list — Test lead first
  const testLead = {
    email: "laubert.bb@gmail.com",
    first_name: "Branislav",
    last_name: " Laubert",
    company_name: "Arcigy Group",
    website: "https://arcigy.group",
    custom_fields: {
      personalized_intro: "Zaujalo ma, ako sa zameriavate na prepojenie technológií s reálnymi výsledkami pre klientov, čo je v oblasti AI automatizácie naozaj vzácne.",
      ico: "12345678",
      last_name_with_salutation: "pán Laubert"
    }
  };

  const leadsToUpload = [testLead, ...dbLeads.map((l: any) => {
    const nameParts = (l.decision_maker_name || "").trim().split(/\s+/).filter((p: string) => !p.includes("."));
    const first = nameParts[0] || "";
    const lastRaw = (l.decision_maker_name || "").replace(first, "").trim();
    const last = lastRaw ? ` ${lastRaw}` : "";

    return {
      email: l.email,
      first_name: first,
      last_name: last,
      company_name: l.official_company_name || "",
      website: l.website,
      custom_fields: {
        personalized_intro: l.icebreaker_sentence || "",
        ico: l.ico || "",
        last_name_with_salutation: l.decision_maker_last_name || `pán${last}`
      }
    };
  })];
  console.log(`📧 Celkovo leadov: ${leadsToUpload.length} (vrátane test leadu)`);

  // 5. Create Campaign
  console.log("\n🚀 Vytváram kampaň 'Automobilky'...");
  const createRes = await fetchTool({
    url: `${baseUrl}/campaigns/create?api_key=${apiKey}`,
    method: "POST",
    body: { name: "Automobilky", client_id: null }
  });
  const campaignId = (createRes.data as any).id;
  if (!campaignId) throw new Error("Nepodarilo sa vytvoriť kampaň");
  console.log(`✅ Kampaň vytvorená! ID: ${campaignId}`);

  // 6. Add AI Sequences
  console.log("📝 Pridávam AI sekvencie...");
  const seqRes = await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/sequences?api_key=${apiKey}`,
    method: "POST",
    body: { sequences: aiSequences }
  });
  if (seqRes.status !== 200) throw new Error(`Sekvencie zlyhali: ${JSON.stringify(seqRes.data)}`);
  console.log("✅ Sekvencie pridané!");

  // 7. Link all 4 email accounts
  console.log("🔗 Prepájam 4 email účty...");
  await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/email-accounts?api_key=${apiKey}`,
    method: "POST",
    body: { email_account_ids: [14382544, 14382530, 14382508, 14382300] }
  });
  console.log("✅ Účty prepojené!");

  // 8. Schedule
  console.log("⏰ Nastavujem rozvrh...");
  await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/schedule?api_key=${apiKey}`,
    method: "POST",
    body: {
      timezone: "Europe/Bratislava",
      start_hour: "08:00",
      end_hour: "18:00",
      days_of_the_week: [1, 2, 3, 4, 5],
      max_new_leads_per_day: 30,
      min_time_btw_emails: 15,
      schedule_start_time: null
    }
  });
  console.log("✅ Rozvrh nastavený!");

  // 9. Settings
  console.log("⚙️ Nastavujem settings...");
  await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/settings?api_key=${apiKey}`,
    method: "PATCH",
    body: {
      track_settings: ["DONT_TRACK_EMAIL_OPEN"],
      stop_lead_settings: "REPLY_TO_AN_EMAIL",
      follow_up_percentage: 100
    }
  });
  console.log("✅ Settings nastavené!");

  // 10. Webhook
  console.log("🔔 Pridávam webhook...");
  await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/webhooks?api_key=${apiKey}`,
    method: "POST",
    body: {
      id: null,
      name: "AI Reply Webhook",
      webhook_url: "https://automation-arcigy.up.railway.app/webhook/smartlead-ai-reply",
      event_types: ["LEAD_CATEGORY_UPDATED", "EMAIL_REPLY"]
    }
  });
  console.log("✅ Webhook pridaný!");

  // 11. Upload Leads in batches
  console.log(`📤 Nahrávam ${leadsToUpload.length} leadov...`);
  const BATCH = 100;
  for (let i = 0; i < leadsToUpload.length; i += BATCH) {
    const batch = leadsToUpload.slice(i, i + BATCH);
    await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/leads?api_key=${apiKey}`,
      method: "POST",
      body: { lead_list: batch, settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false } }
    });
    console.log(`  - Batch ${Math.floor(i / BATCH) + 1} ✅`);
    await new Promise(r => setTimeout(r, 300));
  }

  // 12. Activate
  console.log("⚡ Aktivujem kampaň...");
  await fetchTool({
    url: `${baseUrl}/campaigns/${campaignId}/status?api_key=${apiKey}`,
    method: "PATCH",
    body: { status: "ACTIVE" }
  });

  console.log(`\n🎉 HOTOVO!`);
  console.log(`📊 Campaign ID: ${campaignId}`);
  console.log(`📧 Leadov: ${leadsToUpload.length}`);
  console.log(`🔗 https://app.smartlead.ai/app/campaigns/${campaignId}`);
  process.exit(0);
}

createAutomobilkyCampaign().catch(err => {
  console.error("🔥 CHYBA:", err.message);
  process.exit(1);
});
