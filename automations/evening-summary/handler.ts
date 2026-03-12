import { sql } from "../../core/db";
import { slackSendMessageTool } from "../../tools/slack/send-message.tool";
import { handler as syncHandler } from "../smartlead-sync/handler";
import type { AutomationResult } from "../../core/types";

export async function handler(): Promise<AutomationResult<any>> {
  console.log("🌙 Generujem večerný report...");

  try {
    // 1. Najprv zosynchronizuj dáta zo Smartleadu
    await syncHandler();

    // 2. Získaj štatistiky za posledných 24 hodín
    const stats = await sql`
      SELECT 
        COUNT(*) filter (where updated_at >= now() - interval '24 hours' AND sent_to_smartlead = true) as sent_today,
        COUNT(*) filter (where reply_status = 'REPLIED' AND updated_at >= now() - interval '24 hours') as replies_today,
        COUNT(*) filter (where reply_sentiment = 'Interested' AND updated_at >= now() - interval '24 hours') as positive_today
      FROM leads
    `;

    const s = stats[0];

    // 3. Získaj zoznam ľudí, ktorí dnes odpísali
    const recentReplied = await sql`
      SELECT decision_maker_name, company_name_short, reply_sentiment, website
      FROM leads
      WHERE reply_status = 'REPLIED' 
      AND updated_at >= now() - interval '24 hours'
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    // 4. Formátuj Slack správu
    let message = `🌙 *Večerný Prehľad Dňa — ${new Date().toLocaleDateString('sk-SK')}*\n\n`;
    message += `🚀 *Odoslané maily:* ${s.sent_today}\n`;
    message += `📬 *Celkové odpovede:* ${s.replies_today}\n`;
    message += `🔥 *Z toho pozitívne:* ${s.positive_today}\n\n`;

    if (recentReplied.length > 0) {
      message += `*Dnešné reakcie:*\n`;
      recentReplied.forEach(r => {
        const sentimentEmoji = r.reply_sentiment === 'Interested' ? '✅' : '⚪';
        message += `• ${sentimentEmoji} *${r.decision_maker_name || 'Neznámy'}* (${r.company_name_short}) - _${r.reply_sentiment || 'Bez kategórie'}_ <${r.website}|web>\n`;
      });
    } else {
      message += `_Dnes zatiaľ žiadne nové odpovede._\n`;
    }

    message += `\n📊 _Všetko je v databáze zosynchronizované a pripravené na zajtra._`;

    // 5. Pošli správanie
    await slackSendMessageTool({
      text: "🌙 Arcigy Večerný Prehľad",
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: message }
        }
      ]
    });

    return { success: true, data: s, durationMs: 0 };

  } catch (error: any) {
    console.error("❌ Večerný report zlyhal:", error.message);
    return { success: false, error: error.message, durationMs: 0 };
  }
}
