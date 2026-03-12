import { sql, isSystemActive } from "../../core/db";
import { env } from "../../core/env";
import { fetchTool } from "../../tools/http/fetch.tool";
import { llmCallTool } from "../../tools/ai/llm-call.tool";
import type { EnrichedLead } from "../lead-enricher/schema";
import { logNicheStats } from "../niche-manager/handler";
import { slackSendMessageTool } from "../../tools/slack/send-message.tool";

const BASE_URL = "https://server.smartlead.ai/api/v1";
const KEY = () => `api_key=${env.SMARTLEAD_API_KEY}`;

// ─── AI Sequence Generator ───────────────────────────────────────────────────

async function generateSequences(niche_name: string) {
  const systemPrompt = `Si expert na cold email outreach a automatizáciu predaja. 
Tvojou úlohou je upraviť existujúcu úspešnú sekvenciu pre novú cieľovú skupinu (niche).

Pôvodná sekvencia:
1. Email: Predmet: Len taká úvaha nad {{company_name}}. Text: Riešite telefonáty, manuálne odpovedanie, AI audit na filtráciu záujemcov.
2. Email: Predmet: RE. Text: Či mail nespadol do spamu, stručné áno/nie.

VŽDY vráť JSON v tomto formáte:
{
  "variantA": { "subject": "...", "body": "..." },
  "variantB": { "subject": "...", "body": "..." },
  "followup": { "subject": "", "body": "..." }
}

Pravidlá:
- Používaj slovenčinu, neformálny ale profesionálny tón.
- Sekvenciu VŽDY začni oslovením: Dobrý deň{{last_name}},
- Používaj premenné: {{last_name}}, {{personalized_intro}}, {{company_name}}, %signature%, %sender-firstname%.
- Variant B musí byť iný prístup (napr. viac direct alebo viac zameraný na konkrétny problém v danej niche).
- Followup začni tiež oslovením: Dobrý deň{{last_name}},
- Niche: ${niche_name}`;

  const userMessage = `Vytvor 2 varianty prvého emailu a 1 followup pre niche: ${niche_name}`;
  
  const aiResult = await llmCallTool({
    systemPrompt,
    userMessage,
    model: "claude-3-5-sonnet-20241022"
  });

  try {
    return JSON.parse(aiResult.content);
  } catch (e) {
    console.error("AI Sequence parsing error, using fallback template");
    return null; // Fallback handled in main logic
  }
}

// ─── Find or create campaign ─────────────────────────────────────────────────

async function findOrCreateCampaign(niche_slug: string, niche_name: string, niche_id: string): Promise<number | null> {
  const active = await isSystemActive('leadgen_active');
  if (!active) {
    console.log(`⏸️ Lead Generation je v systéme POZASTAVENÝ. Preskakujem vytváranie kampane.`);
    return null;
  }
  const campaignName = `${niche_slug}_SK`;

  const cached = await sql`SELECT smartlead_campaign_id FROM niches WHERE id = ${niche_id}`;
  if (cached[0]?.smartlead_campaign_id) {
    return parseInt(cached[0].smartlead_campaign_id);
  }

  const res = await fetchTool({ url: `${BASE_URL}/campaigns?${KEY()}` });
  const campaigns = (res.data as any[]) || [];
  const existing = campaigns.find((c: any) => c.name === campaignName);

  if (existing) {
    await sql`UPDATE niches SET smartlead_campaign_id = ${String(existing.id)} WHERE id = ${niche_id}`;
    return existing.id;
  }

  const created = await fetchTool({
    url: `${BASE_URL}/campaigns/create?${KEY()}`,
    method: "POST",
    body: { name: campaignName, client_id: null }
  });

  const newId = (created.data as any).id;
  if (!newId) throw new Error(`Nepodarilo sa vytvoriť kampaň: ${JSON.stringify(created.data)}`);

  console.log(`✅ Nová kampaň vytvorená: "${campaignName}" (ID: ${newId})`);

  // 1. Generate and Add Sequences (A/B testing)
  console.log(`  ✉️ Generujem AI sekvencie pre ${niche_name}...`);
  const aiSeqs = await generateSequences(niche_name);
  
  await fetchTool({
    url: `${BASE_URL}/campaigns/${newId}/sequences?${KEY()}`,
    method: "POST",
    body: {
      sequences: [
        {
          seq_number: 1,
          seq_delay_details: { delay_in_days: 0 },
          seq_variants: [
            {
              variant_label: "A",
              subject: aiSeqs?.variantA?.subject || `Len taká úvaha nad {{company_name}}`,
              email_body: aiSeqs?.variantA?.body || `<p>Dobrý deň{{last_name}},</p><p>{{personalized_intro}}</p><p>Úprimne – kedy ste mali naposledy víkend bez telefonátov?</p><p>%signature%</p>`
            },
            {
              variant_label: "B",
              subject: aiSeqs?.variantB?.subject || `Otázka k {{company_name}} a automatizácii`,
              email_body: aiSeqs?.variantB?.body || `<p>Dobrý deň{{last_name}},</p><p>Všimol som si váš web a napadlo mi, či neriešite až príliš veľa manuálnej práce s dopytmi.</p><p>%signature%</p>`
            }
          ]
        },
        {
          seq_number: 2,
          seq_delay_details: { delay_in_days: 3 },
          seq_variants: [{
            variant_label: "A",
            subject: "",
            email_body: aiSeqs?.followup?.body || `<p>Dobrý deň{{last_name}},</p><p>Len som sa chcel uistiť, či môj mail nespadol do spamu.</p><p>%sender-firstname%</p>`
          }]
        }
      ]
    }
  });

  // 2. Link Email Accounts
  const accountsRes = await fetchTool({ url: `${BASE_URL}/email-accounts?${KEY()}` });
  const activeAccounts = (accountsRes.data as any[] || [])
    .filter(a => a.status === 'OK' || a.status === 'ACTIVE' || !a.status)
    .map(a => a.id);

  if (activeAccounts.length > 0) {
    await fetchTool({
      url: `${BASE_URL}/campaigns/${newId}/email-accounts?${KEY()}`,
      method: "POST",
      body: { email_account_ids: activeAccounts }
    });
  }

  const limitPerAccount = activeAccounts.length > 0 ? Math.floor(120 / activeAccounts.length) : 30;

  // 3. Update Schedule (PATCH)
  await fetchTool({
    url: `${BASE_URL}/campaigns/${newId}/schedule?${KEY()}`,
    method: "POST", // documentation said POST for schedule/create/sequences
    body: {
      timezone: "Europe/Bratislava",
      start_hour: "08:00",
      end_hour: "18:00",
      days_of_the_week: [1, 2, 3, 4, 5],
      max_new_leads_per_day: limitPerAccount,
      min_time_btw_emails: 15,
      schedule_start_time: null
    }
  });

  // 4. Settings (PATCH per documentation)
  await fetchTool({
    url: `${BASE_URL}/campaigns/${newId}/settings?${KEY()}`,
    method: "PATCH",
    body: {
      track_settings: ["DONT_TRACK_EMAIL_OPEN"],
      stop_lead_settings: "REPLY_TO_AN_EMAIL",
      follow_up_percentage: 100
    }
  });

  // 5. Webhooks
  const webhookUrl = "https://automation-arcigy.up.railway.app/webhook/smartlead-ai-reply";
  await fetchTool({
    url: `${BASE_URL}/campaigns/${newId}/webhooks?${KEY()}`,
    method: "POST",
    body: {
      id: null,
      name: `AI Reply Webhook`,
      webhook_url: webhookUrl,
      event_types: ["LEAD_CATEGORY_UPDATED", "EMAIL_SENT", "EMAIL_OPEN", "EMAIL_LINK_CLICK", "EMAIL_REPLY", "LEAD_UNSUBSCRIBED"]
    }
  });

  // 6. Final Review & Start (PATCH)
  console.log(`  ⏳ Aktivujem kampaň...`);
  await fetchTool({
    url: `${BASE_URL}/campaigns/${newId}/status?${KEY()}`,
    method: "PATCH",
    body: { status: "ACTIVE" }
  });

  await sql`UPDATE niches SET smartlead_campaign_id = ${String(newId)} WHERE id = ${niche_id}`;

  await slackSendMessageTool({
    text: `🚀 *Nová kampaň Smartlead*: "${campaignName}" (ID: ${newId})\n- Niche: ${niche_name}\n- Účty: ${activeAccounts.length}\n- Limit: ${limitPerAccount}/account (Total 120)`
  });

  return newId;
}

// ... rest of the file (uploadLeads, injectToSmartlead) ...
async function uploadLeads(campaign_id: number, leads: EnrichedLead[]): Promise<number> {
  const BATCH_SIZE = 50;
  let uploaded = 0;
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const payload = batch.map(lead => {
      const nameParts = (lead.decision_maker_name || "").trim().split(/\s+/);
      const lastNameRaw = nameParts.slice(1).join(" ");
      // User style: last_name always starts with a space if it exists: " Novák"
      const lastNameFormatted = lastNameRaw ? ` ${lastNameRaw}` : "";

      return {
        email: lead.email!,
        first_name: nameParts[0] || lead.company_name_short || "",
        last_name: lastNameFormatted,
        company_name: lead.official_company_name || lead.company_name_short || "",
        website: lead.website || "",
        custom_fields: {
          personalized_intro: lead.icebreaker_sentence || "",
          ico: lead.ico || "",
        }
      };
    });
    try {
      const res = await fetchTool({
        url: `${BASE_URL}/campaigns/${campaign_id}/leads?${KEY()}`,
        method: "POST",
        body: { lead_list: payload, settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false } }
      });
      uploaded += (res.data as any)?.upload_count || batch.length;
      await new Promise(r => setTimeout(r, 2500));
    } catch (e: any) { console.warn(`Batch failed: ${e.message}`); }
  }
  return uploaded;
}

export async function injectToSmartlead(leads: EnrichedLead[], niche: { id: string; slug: string; name: string }): Promise<{ sent: number }> {
  const active = await isSystemActive('leadgen_active');
  if (!active) {
    console.log(`⏸️ Lead Generation je v systéme POZASTAVENÝ. Preskakujem injection.`);
    return { sent: 0 };
  }
  const campaign_id = await findOrCreateCampaign(niche.slug, niche.name, niche.id);
  if (!campaign_id) return { sent: 0 };
  const sent = await uploadLeads(campaign_id, leads);
  const websites = leads.map(l => l.website).filter(Boolean);
  if (websites.length > 0) {
    await sql`UPDATE leads SET sent_to_smartlead = true, niche_id = ${niche.id} WHERE website = ANY(${sql.array(websites)})`;
  }
  await logNicheStats(niche.id, { sent_to_smartlead: sent });
  
  await slackSendMessageTool({
    text: `📥 *Smartlead Lead Injection*: ${sent} leadov nahratých do kampaňe "${niche.slug}_SK"`
  });

  return { sent };
}
