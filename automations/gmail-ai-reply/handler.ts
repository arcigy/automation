import { randomUUID } from 'crypto';
import { inputSchema, type Input, type Output } from './schema';
import { logRun } from '../../core/logger';
import type { AutomationContext, AutomationResult } from '../../core/types';
import { sql, isSystemActive } from '../../core/db';
import { fetchUnreadInboxMessages, sendGmailReply, fetchThreadHistory } from '../../tools/google/gmail-history.tool';
import { geminiCallTool } from '../../tools/ai/gemini-call.tool';

const SENDER_EMAILS = [
  'branislav.l@arcigy.group',
  'branislav@arcigy.group',
  'andrej.r@arcigy.group',
  'andrej@arcigy.group'
];

export async function handler(rawInput: unknown): Promise<AutomationResult<Output>> {
  const input = inputSchema.parse(rawInput || {});
  
  const ctx: AutomationContext = {
    automationName: input.dry_run ? 'gmail-ai-reply:dry-run' : 'gmail-ai-reply',
    runId: randomUUID(),
    startTime: Date.now(),
  };

  const out: Output = {
    processedMessages: 0,
    repliesSent: 0,
    skipped: 0,
    errors: 0
  };

  if (!input.dry_run) {
    const active = await isSystemActive('ai_replies_active');
    if (!active) {
      console.log(`⏸️ AI Replies sú v systéme POZASTAVENÉ. Preskakujem Gmail polling.`);
      const result: AutomationResult<Output> = { success: true, data: out, durationMs: Date.now() - ctx.startTime };
      await logRun(ctx, result, input);
      return result;
    }
  }

  try {
    for (const senderEmail of SENDER_EMAILS) {
      console.log(`📥 Kontrolujem doručenú poštu pre ${senderEmail}...`);
      const unreadMessages = await fetchUnreadInboxMessages(senderEmail, 15);
      
      for (const msg of unreadMessages) {
        try {
          // Check if already processed
          const processedCheck = await sql`SELECT message_id FROM processed_gmail_messages WHERE message_id = ${msg.id}`;
          if (processedCheck.length > 0) {
            continue; // Already processed
          }

          const fromEmail = extractEmail(msg.from);
          out.processedMessages++;

          // Check if lead exists
          const leads = await sql`SELECT id, original_name, primary_email FROM leads WHERE primary_email ILIKE ${fromEmail} LIMIT 1`;
          if (leads.length === 0) {
            console.log(`ℹ️ Správa z ${fromEmail} nie je od známeho leada. Preskakujem.`);
            if (!input.dry_run) await markProcessed(msg.id);
            out.skipped++;
            continue;
          }

          const lead = leads[0];
          console.log(`🔍 Analyzujem správu od leada ${fromEmail} [MsgID: ${msg.id}]`);

          // Fetch full history of this specific thread
          const history = await fetchThreadHistory(msg.threadId, senderEmail);

          // Thread Validation Check
          if (history.length > 0 && !history[0].isMe) {
            console.log(`ℹ️ Preskakujem: Konverzáciu sme nezačali my (lead napísal sám od seba, mimo cold emailovej nite).`);
            if (!input.dry_run) await markProcessed(msg.id);
            out.skipped++;
            continue;
          }
          // Human-in-the-loop check
          const leadMessages = history.filter((m: any) => !m.isMe);
          if (leadMessages.length > 0) {
            const lastLeadMessage = leadMessages[leadMessages.length - 1];
            const lastLeadMessageIndex = history.indexOf(lastLeadMessage);
            const messagesAfterLead = history.slice(lastLeadMessageIndex + 1);
            const hasOurReplyAfterLead = messagesAfterLead.some((m: any) => m.isMe);

            if (hasOurReplyAfterLead) {
              console.log(`ℹ️ Preskakujem: Detegovaná manuálna odpoveď po poslednej správe leada.`);
              if (!input.dry_run) await markProcessed(msg.id);
              out.skipped++;
              continue;
            }
          }

          // Check duplicate campaign reply 
          // (Since we don't have Smartlead campaign context, we just check if we ever sent a reply to this lead via AI recently)
          const existingReply = await sql`SELECT id FROM sent_replies WHERE lead_email = ${fromEmail} LIMIT 1`;
          if (existingReply.length > 0) {
            console.log(`ℹ️ Preskakujem: Tomuto leadovi sme už cez AI odpovedali.`);
            if (!input.dry_run) await markProcessed(msg.id);
            out.skipped++;
            continue;
          }

          const senderName = senderEmail.split('.')[0].charAt(0).toUpperCase() + senderEmail.split('.')[0].slice(1);
          const classification = await classifyReply(msg.body, history, senderName);
          console.log(`🧠 AI Klasifikácia: ${classification}`);

          if (classification !== 'POSITIVE') {
            console.log(`ℹ️ Preskakujem: Nejde o pozitívny záujem.`);
            if (!input.dry_run) await markProcessed(msg.id);
            out.skipped++;
            continue;
          }

          // Generate AI Reply
          const aiReplyHtml = await generateReply({
            leadEmail: fromEmail,
            leadName: lead.original_name || '',
            leadReplyBody: msg.body,
            history,
            senderEmail,
            senderName
          });

          if (!input.dry_run) {
            console.log(`🚀 Odosielam Gmail odpoveď pre ${fromEmail}...`);
            await sendGmailReply(
              senderEmail,
              fromEmail,
              msg.subject,
              msg.threadId,
              msg.id,
              aiReplyHtml
            );

            await sql`
              INSERT INTO sent_replies (lead_email, campaign_id)
              VALUES (${fromEmail}, 'GMAIL_DIRECT')
              ON CONFLICT (lead_email, campaign_id) DO NOTHING
            `;
            await markProcessed(msg.id);
          } else {
            console.log(`[DRY-RUN] Odpoveď by bola odoslaná:\n${aiReplyHtml}`);
          }

          out.repliesSent++;
        } catch (msgErr: any) {
          console.error(`❌ Error processing message ${msg.id}:`, msgErr);
          out.errors++;
        }
      }
    }

    const result: AutomationResult<Output> = {
      success: true,
      data: out,
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

// --- Pomocné funkcie ---

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase().trim() : fromHeader.toLowerCase().trim();
}

async function markProcessed(messageId: string) {
  try {
    await sql`
      INSERT INTO processed_gmail_messages (message_id) 
      VALUES (${messageId}) 
      ON CONFLICT DO NOTHING
    `;
  } catch (e) {
    console.error("Failed to mark message as processed:", e);
  }
}

async function classifyReply(replyBody: string, history: any[] = [], senderName: string = 'Branislav'): Promise<'POSITIVE' | 'NEGATIVE' | 'ALREADY_SENT' | 'NEUTRAL'> {
  const formattedHistory = history
    .map((m: any) => {
      const sender = m.isMe ? senderName : 'LEAD';
      const body = m.body.replace(/<[^>]*>/g, ' ').trim();
      return `[${sender}]: ${body}`;
    })
    .join('\n---\n');

  const systemPrompt = `You are an expert sales assistant for Arcigy. Your job is to classify if a lead wants to see a demo/showcase link.

Categories:
- POSITIVE: The lead explicitly expresses interest or says "yes" to seeing the showcase. Examples: "ok", "pošlite", "zaujíma ma to", "skúsme", "môžete poslať", "send it", "please send", "sure".
- NEGATIVE: The lead is NOT interested or declines the offer. This includes:
    * Explicit "No": "nie", "nie ďakujem", "no thanks", "nepíšte mi".
    * Lack of Interest: "nemám záujem", "nezaujíma ma", "not interested".
    * Irrelevance / No need: "neriešime to", "nemáme tento problém", "nepotrebujeme to", "we don't have this issue", "not relevant", "už to máme vyriešené".
    * Rejection of meeting/offer: "nemám čas", "možno inokedy".
- ALREADY_SENT: The lead asks for the link, but in the history you see that [${senderName}] ALREADY sent a link (https://www.arcigy.com/showcase) AFTER their previous inquiry.
- NEUTRAL: Just saying "thank you", asking a technical question without interest, or "out of office" replies.

CRITICAL: If there is any doubt or the response is even slightly negative/rejecting, classify as NEGATIVE. We only want to reply to clear POSITIVE interest.

Reply ONLY with the category name.`;

  const userMessage = `CONVERSATION HISTORY:
${formattedHistory}

LATEST LEAD REPLY:
"${replyBody}"`;

  const result = await geminiCallTool({
    systemPrompt,
    userMessage,
    model: 'gemini-2.5-flash',
    maxTokens: 100,
  });

  const content = result.content.trim().toUpperCase();
  if (content.includes('POSITIVE')) return 'POSITIVE';
  if (content.includes('NEGATIVE')) return 'NEGATIVE';
  if (content.includes('ALREADY_SENT')) return 'ALREADY_SENT';
  return 'NEUTRAL';
}

function extractGreeting(leadName?: string, emailBody?: string): string {
  if (leadName) {
    const parts = leadName.trim().split(/\s+/);
    if (parts.length >= 2) return parts[parts.length - 1];
  }
  if (emailBody) {
    const signaturePatterns = [
      /S pozdravom[,\s]+([A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][a-záčďéíľĺňóôŕšťúýž]+\s+[A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][a-záčďéíľĺňóôŕšťúýž]+)/i,
      /Pozdravuje[,\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /Regards[,\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    ];
    for (const pattern of signaturePatterns) {
      const match = emailBody.match(pattern);
      if (match) {
        const nameParts = match[1].trim().split(/\s+/);
        return nameParts[nameParts.length - 1];
      }
    }
  }
  return '';
}

interface GenerateReplyInput {
  leadEmail: string;
  leadName?: string;
  leadReplyBody: string;
  history: any[];
  senderEmail?: string;
  senderName?: string;
}

async function generateReply(input: GenerateReplyInput): Promise<string> {
  const surname = extractGreeting(input.leadName, input.leadReplyBody);
  const senderName = input.senderName || 'Branislav';

  const formattedHistory = input.history
    .map((m: any) => {
      const sender = m.isMe ? senderName : 'LEAD';
      const body = m.body.replace(/<[^>]*>/g, ' ').trim();
      return `[${sender}]: ${body}`;
    })
    .join('\n---\n');

  const systemPrompt = `You are a male professional sales assistant named ${senderName} responding to cold email replies on behalf of Arcigy.
Write a short, warm, formal reply ALWAYS in Slovak language.

Rules:
- You are writing as ${senderName} (${input.senderEmail}).
- Use formal address: "Dobrý deň pani/pán [Priezvisko],"
- Extract surname: second word from lead_name, or from email signature if lead_name unavailable
- If no name found at all: use "Dobrý deň,"
- Use first-person singular (JA - I) for the entire response. Use masculine forms.
- CONTEXT: You have the full conversation history. Use it to sound natural.
- Tone: The reply should acknowledge previous context.
- Maximum 3 sentences
- Sound professional but warm — not robotic or overly corporate
- Always include the link and refer to it as "ukážka" (showcase), NEVER use the word "portfólio".
- Link: <a href='https://www.arcigy.com/showcase'>https://www.arcigy.com/showcase</a>
- PRICING (CENA): If the lead asks about price, explain that it depends on the complexity of the automation. Mention that you can discuss pricing in detail during a call, which they can book directly on our website. Suggest they first view the promised showcase ("ukážka").
- No subject line, no sign-off, no signature — reply body only
- Use formal address (VYKANIE in Slovak) for the entire response
- Format the reply as simple HTML. Use <br><br> for paragraph breaks.
- Never mention AI or automation`;

  const userMessage = `Full Conversation History:
${formattedHistory}

Lead surname to use: ${surname || '[unknown]'}
Lead email: ${input.leadEmail}
Their latest reply: "${input.leadReplyBody || '[no reply body available]'}"

Write the reply now.`;

  const llmResult = await geminiCallTool({
    systemPrompt,
    userMessage,
    model: 'gemini-2.5-flash',
    maxTokens: 2048,
  });

  return llmResult.content.trim();
}
