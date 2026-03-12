import { sql } from "../../core/db";
import { env } from "../../core/env";
import { slackSendMessageTool } from "../../tools/slack/send-message.tool";
import { fetchTool } from "../../tools/http/fetch.tool";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { logRun } from "../../core/logger";

export async function handler(): Promise<AutomationResult<any>> {
  const ctx = {
    automationName: "daily-report",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  try {
    // 1. Get Smartlead Stats
    console.log("📊 Sťahujem štatistiky zo Smartleadu...");
    const campaignsRes = await fetchTool({ 
      url: `https://server.smartlead.ai/api/v1/campaigns?api_key=${env.SMARTLEAD_API_KEY}` 
    });
    const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];
    
    let totalSent = 0;
    let totalOpened = 0;
    let totalReplied = 0;

    campaigns.forEach((c: any) => {
      // In Smartlead, these are cumulative, but for the daily report we just show current state
      totalSent += c.stats?.sent_count || 0;
      totalOpened += c.stats?.open_count || 0;
      totalReplied += c.stats?.reply_count || 0;
    });

    // 2. STUCK LEADS (Waiting for manual review)
    const stuckLeads = await sql`
      SELECT l.website, l.decision_maker_name, l.primary_email as email, l.phone, n.name as niche_name
      FROM leads l
      JOIN niches n ON l.niche_id = n.id
      WHERE l.sent_to_smartlead = false
      AND (l.verification_status IS NULL OR l.verification_status != 'failed')
      AND l.manually_reviewed = false
      ORDER BY n.name ASC, l.website ASC
      LIMIT 15
    `;

    // 3. System Status
    const settings = await sql`SELECT key, value FROM system_settings`;
    const leadgenActive = settings.find(s => s.key === 'leadgen_active')?.value ?? true;
    const aiRepliesActive = settings.find(s => s.key === 'ai_replies_active')?.value ?? true;

    // 4. Format Slack Message
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `📊 Denný Report — ${new Date().toLocaleDateString('sk-SK')}` }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `📧 *Odoslané:* ${totalSent}` },
          { type: "mrkdwn", text: `📖 *Otvorené:* ${totalOpened}` },
          { type: "mrkdwn", text: `💬 *Odpovede:* ${totalReplied}` },
          { type: "mrkdwn", text: `🎯 *Kampane:* ${campaigns.length}` }
        ]
      },
      { type: "divider" }
    ];

    if (stuckLeads.length > 0) {
      let stuckText = `⚠️ *Čaká na schválenie:* ${stuckLeads.length} leadov\n`;
      stuckLeads.forEach((l, i) => {
        stuckText += `• <${l.website}|${l.website.replace(/^https?:\/\/(www\.)?/, "").split('/')[0]}> (${l.niche_name})\n`;
      });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: stuckText }
      });
    } else {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "✅ *Všetky leady sú spracované alebo v Smartleade.*" }
      });
    }

    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "⚙️ *Ovládací Panel*" }
    });

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: leadgenActive ? "⏸️ Leadgen (Active)" : "🚀 Leadgen (Paused)" },
          style: leadgenActive ? "danger" : "primary",
          action_id: "toggle_leadgen"
        },
        {
          type: "button",
          text: { type: "plain_text", text: aiRepliesActive ? "⏸️ AI Replies (Active)" : "🚀 AI Replies (Paused)" },
          style: aiRepliesActive ? "danger" : "primary",
          action_id: "toggle_ai_replies"
        }
      ]
    });

    // 5. Send to Slack
    await slackSendMessageTool({
      text: "📊 Arcigy Daily Report",
      blocks: blocks
    });

    const result = { success: true, data: { total_sent: totalSent }, durationMs: Date.now() - ctx.startTime };
    await logRun(ctx, result, {});
    return result;

  } catch (error: any) {
    console.error("Daily report failed:", error);
    const result = { success: false, error: error.message, durationMs: Date.now() - ctx.startTime };
    await logRun(ctx, result, {});
    throw error;
  }
}
