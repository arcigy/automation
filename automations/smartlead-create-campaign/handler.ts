import { inputSchema, type Input, type Output } from "./schema";
import { logRun } from "../../core/logger";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { env } from "../../core/env";
import { fetchTool } from "../../tools/http/fetch.tool";
import { smartleadGenerateSequencesTool } from "../../tools/smartlead/generate-sequences.tool";

export async function handler(
  rawInput: unknown,
): Promise<AutomationResult<Output>> {
  const ctx = {
    automationName: "smartlead-create-campaign",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  const input = inputSchema.parse(rawInput);
  const baseUrl = "https://server.smartlead.ai/api/v1";
  const apiKey = env.SMARTLEAD_API_KEY;

  try {
    // 1. Determine Sequences (AI or manual)
    let finalSequences: any[] = [];

    if (input.generateAiSequences) {
        console.log(`🤖 Generating AI sequences for niche: ${input.name}...`);
        const aiSeqs = await smartleadGenerateSequencesTool({
            nicheName: input.name,
            nicheDescription: input.nicheDescription,
            customInstructions: input.customAiInstructions
        });
        
        // Map to Smartlead's expected structure (variants)
        finalSequences = aiSeqs.map((s: any) => ({
            seq_number: s.seq_number,
            seq_delay_details: s.seq_delay_details,
            seq_variants: s.seq_variants.map((v: any) => ({
                variant_label: v.variant_label,
                subject: v.subject,
                email_body: v.email_body
            }))
        }));
    } else if (input.sequences) {
        // Map simple input structure to Smartlead's verbose structure
        finalSequences = input.sequences.map((s, idx) => ({
            seq_number: idx + 1,
            seq_delay_details: { delay_in_days: s.delay_in_days },
            seq_variants: [
                {
                    variant_label: "A",
                    subject: s.subject || "",
                    email_body: s.body
                }
            ]
        }));
    } else {
        throw new Error("Either 'sequences' or 'generateAiSequences: true' must be provided.");
    }

    // 2. Create Campaign
    console.log(`🚀 Creating campaign: ${input.name}...`);
    const createRes = await fetchTool({
      url: `${baseUrl}/campaigns/create?api_key=${apiKey}`,
      method: "POST",
      body: {
        name: input.name,
        client_id: input.client_id || null
      }
    });

    if (createRes.status !== 200 && createRes.status !== 201) {
      throw new Error(`Failed to create campaign: ${JSON.stringify(createRes.data)}`);
    }

    const campaignId = (createRes.data as any).id;

    // 3. Add Sequences (Verified Structure)
    console.log(`📝 Adding ${finalSequences.length} sequences...`);
    const sequenceRes = await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/sequences?api_key=${apiKey}`,
      method: "POST",
      body: { sequences: finalSequences }
    });

    if (sequenceRes.status !== 200) {
      throw new Error(`Failed to add sequences: ${JSON.stringify(sequenceRes.data)}`);
    }

    // 4. Link Email Accounts
    console.log(`🔗 Linking ${input.email_account_ids.length} email accounts...`);
    const linkRes = await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/email-accounts?api_key=${apiKey}`,
      method: "POST",
      body: {
        email_account_ids: input.email_account_ids
      }
    });

    if (linkRes.status !== 200) {
      throw new Error(`Failed to link email accounts: ${JSON.stringify(linkRes.data)}`);
    }

    // 5. Update Schedule
    console.log(`⏰ Setting schedule...`);
    const scheduleBody = {
      timezone: input.schedule?.timezone || "Europe/Bratislava",
      start_hour: input.schedule?.start_hour || "08:00",
      end_hour: input.schedule?.end_hour || "18:00",
      days_of_the_week: input.schedule?.days || [1, 2, 3, 4, 5],
      max_new_leads_per_day: input.daily_limit,
      min_time_btw_emails: input.min_delay_between_emails,
      schedule_start_time: null
    };

    await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/schedule?api_key=${apiKey}`,
      method: "POST",
      body: scheduleBody
    });

    // 6. Update Settings
    console.log(`⚙️ Setting settings...`);
    await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/settings?api_key=${apiKey}`,
      method: "PATCH",
      body: {
        track_settings: input.track_open ? [] : ["DONT_TRACK_EMAIL_OPEN"],
        stop_lead_settings: input.stop_on_reply ? "REPLY_TO_AN_EMAIL" : "NEVER_STOP",
        follow_up_percentage: 100
      }
    });

    // 7. Add Webhooks
    if (input.webhook_url) {
      console.log(`🔔 Adding webhook: ${input.webhook_url}`);
      await fetchTool({
        url: `${baseUrl}/campaigns/${campaignId}/webhooks?api_key=${apiKey}`,
        method: "POST",
        body: {
          id: null,
          name: `Automation Webhook`,
          webhook_url: input.webhook_url,
          event_types: input.webhook_events
        }
      });
    }

    // 8. Upload Leads (optional)
    if (input.leads && input.leads.length > 0) {
      console.log(`📤 Uploading ${input.leads.length} leads...`);
      const CHUNK_SIZE = 100;
      for (let i = 0; i < input.leads.length; i += CHUNK_SIZE) {
        const chunk = input.leads.slice(i, i + CHUNK_SIZE);
        await fetchTool({
          url: `${baseUrl}/campaigns/${campaignId}/leads?api_key=${apiKey}`,
          method: "POST",
          body: {
            lead_list: chunk,
            settings: { ignore_global_block_list: false, ignore_unsubscribe_list: false }
          }
        });
      }
    }

    const result: AutomationResult<Output> = {
      success: true,
      data: {
        campaign_id: campaignId,
        message: `Campaign '${input.name}' launched successfully! AI Sequences: ${input.generateAiSequences}.`
      },
      durationMs: Date.now() - ctx.startTime,
    };

    await logRun(ctx, result, input);
    return result;
  } catch (error: any) {
    const result: AutomationResult<Output> = {
      success: false,
      error: error.message,
      durationMs: Date.now() - ctx.startTime,
    };
    await logRun(ctx, result, input);
    throw error;
  }
}
