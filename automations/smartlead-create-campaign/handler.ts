import { inputSchema, type Input, type Output } from "./schema";
import { logRun } from "../../core/logger";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { env } from "../../core/env";
import { fetchTool } from "../../tools/http/fetch.tool";

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
    // 1. Create Campaign
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

    // 2. Add Sequences
    const sequenceRes = await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/sequences?api_key=${apiKey}`,
      method: "POST",
      body: {
        seq: input.sequences.map((s, index) => ({
          order: index + 1,
          subject: s.subject,
          body: s.body,
          delay_in_days: s.delay_in_days
        }))
      }
    });

    if (sequenceRes.status !== 200) {
      throw new Error(`Failed to add sequences: ${JSON.stringify(sequenceRes.data)}`);
    }

    // 3. Link Email Accounts
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

    // 4. Update Settings & Schedule
    const settingsBody: any = {
      daily_limit_per_email: input.daily_limit,
      stop_on_reply: input.stop_on_reply,
      min_delay_between_emails: input.min_delay_between_emails,
      track_open: input.track_open,
      track_link_click: input.track_link_click
    };

    if (input.schedule) {
      settingsBody.timezone = input.schedule.timezone;
      settingsBody.start_hour = input.schedule.start_hour;
      settingsBody.end_hour = input.schedule.end_hour;
      settingsBody.days_of_the_week = input.schedule.days;
    }

    const settingsRes = await fetchTool({
      url: `${baseUrl}/campaigns/${campaignId}/settings?api_key=${apiKey}`,
      method: "PATCH",
      body: settingsBody
    });

    if (settingsRes.status !== 200) {
      throw new Error(`Failed to update settings: ${JSON.stringify(settingsRes.data)}`);
    }

    // 5. Add Webhooks
    if (input.webhook_url) {
      for (const eventType of input.webhook_events) {
        await fetchTool({
          url: `${baseUrl}/campaigns/${campaignId}/webhooks?api_key=${apiKey}`,
          method: "POST",
          body: {
            webhook_url: input.webhook_url,
            event_type: eventType
          }
        });
      }
    }

    // 6. Upload Leads (optional)
    if (input.leads && input.leads.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < input.leads.length; i += CHUNK_SIZE) {
        const chunk = input.leads.slice(i, i + CHUNK_SIZE);
        const leadRes = await fetchTool({
          url: `${baseUrl}/campaigns/${campaignId}/leads?api_key=${apiKey}`,
          method: "POST",
          body: {
            lead_list: chunk
          }
        });
        if (leadRes.status !== 200 && leadRes.status !== 201) {
          console.error(`Failed to upload lead chunk starting at index ${i}:`, leadRes.data);
        }
      }
    }

    const result: AutomationResult<Output> = {
      success: true,
      data: {
        campaign_id: campaignId,
        message: `Campaign '${input.name}' created and configured successfully. Sequences: ${input.sequences.length}, Senders: ${input.email_account_ids.length}, Leads: ${input.leads?.length || 0}.`
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
