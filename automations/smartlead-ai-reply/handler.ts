import { randomUUID } from 'crypto';
import { inputSchema, type SmartleadWebhookInput, type SmartleadOutput, messageHistoryItemSchema } from './schema';
import { logRun } from '../../core/logger';
import type { AutomationContext, AutomationResult } from '../../core/types';
import { geminiCallTool } from '../../tools/ai/gemini-call.tool';
import { fetchTool } from '../../tools/http/fetch.tool';
import { env } from '../../core/env';
import { sql, isSystemActive } from '../../core/db';
import { fetchGmailHistory } from '../../tools/google/gmail-history.tool';

export async function handler(rawInput: unknown): Promise<AutomationResult<SmartleadOutput>> {
  const input = inputSchema.parse(rawInput);

  // KROK -2: Ignoruj eventy, ktoré nie sú odpoveďou (napr. OPEN, CLICK, SENT)
  // Reagujeme iba na EMAIL_REPLY alebo LEAD_CATEGORY_UPDATED, ktoré majú v tele text
  const allowedTypes = ['EMAIL_REPLY', 'LEAD_CATEGORY_UPDATED'];
  const eventType = input.type?.toUpperCase() || '';
  const hasBody = input.email_body && input.email_body.trim().length > 0;

  if (eventType && !allowedTypes.includes(eventType)) {
    console.log(`ℹ️ Ignorujem event typu ${eventType}. Reagujeme len na odpovede.`);
    return {
      success: true,
      data: {
        leadEmail: input.to_email,
        replySent: false,
        aiReply: `Skipped: Event type ${eventType} ignored.`,
        smartleadResponseStatus: 0,
        usedEmailStatsId: "N/A",
        dry_run: input.dry_run ?? false,
      },
      durationMs: 0,
    };
  }

  if (!hasBody) {
    console.log(`ℹ️ Ignorujem event bez obsahu správy (email_body).`);
    return {
      success: true,
      data: {
        leadEmail: input.to_email,
        replySent: false,
        aiReply: "Skipped: Empty email body.",
        smartleadResponseStatus: 0,
        usedEmailStatsId: "N/A",
        dry_run: input.dry_run ?? false,
      },
      durationMs: 0,
    };
  }

  const ctx: AutomationContext = {
    automationName: input.dry_run ? 'smartlead-ai-reply:dry-run' : 'smartlead-ai-reply',
    runId: randomUUID(),
    startTime: Date.now(),
  };

  // KROK -1: Kontrola stavu systému (iba ak nejde o dry-run)
  if (!input.dry_run) {
    const active = await isSystemActive('ai_replies_active');
    if (!active) {
      console.log(`⏸️ AI Replies sú v systéme POZASTAVENÉ. Preskakujem odpoveď.`);
      return {
        success: true,
        data: {
          leadEmail: input.to_email,
          replySent: false,
          aiReply: "Skipped: AI Replies are currently PAUSED in system settings.",
          smartleadResponseStatus: 0,
          usedEmailStatsId: "N/A",
          dry_run: false,
        },
        durationMs: 0,
      };
    }
  }

  // KROK 0: Kontrola duplicity (iba ak nejde o dry-run)
  if (!input.dry_run) {
    try {
      const existing = await sql`
        SELECT id FROM sent_replies 
        WHERE lead_email = ${input.to_email} 
        AND campaign_id = ${input.campaign_id}
        LIMIT 1
      `;
      if (existing.length > 0) {
        return {
          success: true,
          data: {
            leadEmail: input.to_email,
            replySent: false,
            aiReply: "Skipped: Reply already sent previously for this lead and campaign.",
            smartleadResponseStatus: 0,
            usedEmailStatsId: "N/A",
            dry_run: false,
          },
          durationMs: 0,
        };
      }
    } catch (e) {
      console.error("Local DB check failed, continuing anyway...", e);
    }
  }

  try {
    let messageData;
    let classification;

    try {
      messageData = await fetchMessageHistory(input.campaign_id, input.to_email, input.from_email);
      
      // KROK 1.5: Kontrola "Human-in-the-loop"
      // Ak sme už manuálne odpovedali na predchádzajúcu správu leada, AI by nemalo zasahovať.
      const history = messageData?.history || [];
      
      // Nájdeme index poslednej odpovede od leada v histórii
      const leadMessages = history.filter(m => m.type === 'EMAIL_REPLY' || m.type === 'REPLY' || (!m.isMe && m.from_email !== input.from_email));
      
      if (leadMessages.length > 0) {
        const lastLeadMessage = leadMessages[leadMessages.length - 1];
        const lastLeadMessageIndex = history.indexOf(lastLeadMessage);
        
        // Zistíme, či po tejto poslednej správe od leada existuje v histórii nejaká naša správa
        // (to by znamenalo, že konverzáciu už prevzal človek)
        const messagesAfterLead = history.slice(lastLeadMessageIndex + 1);
        const hasOurReplyAfterLead = messagesAfterLead.some(m => m.type === 'EMAIL_SENT' || m.type === 'SENT' || m.isMe);

        if (hasOurReplyAfterLead) {
          console.log(`ℹ️ Preskakujem: Detegovaná manuálna odpoveď po poslednej správe leada.`);
          const result: AutomationResult<SmartleadOutput> = {
            success: true,
            data: {
              leadEmail: input.to_email,
              replySent: false,
              aiReply: "Skipped: Human-in-the-loop detected (we already replied to a previous message from this lead).",
              smartleadResponseStatus: 0,
              usedEmailStatsId: messageData?.email_stats_id || "N/A",
              dry_run: input.dry_run ?? false,
            },
            durationMs: Date.now() - ctx.startTime,
          };
          await logRun(ctx, result, input);
          return result;
        }
      }

      classification = await classifyReply(input.email_body ?? '', history, messageData?.sender_name);
    } catch (e: any) {
      if (input.dry_run) {
        console.log(`[DRY-RUN] API error: ${e.message}. Using mock data.`);
        messageData = {
          email_stats_id: 'mock-stats-id',
          reply_message_id: 'mock-reply-message-id',
          reply_email_time: new Date().toISOString(),
          history: [],
          sender_name: 'Andrej',
          sender_email: 'andrej.r@arcigy.group'
        };
        // Skúsime klasifikovať aj napriek chybe API (s prázdnou históriou)
        classification = await classifyReply(input.email_body ?? '', [], 'Andrej');
      } else {
        throw e;
      }
    }

    if (!messageData) {
      if (input.dry_run) {
        messageData = {
          email_stats_id: 'mock-stats-id',
          reply_message_id: 'mock-reply-message-id',
          reply_email_time: new Date().toISOString()
        };
      } else {
        throw new Error(`No sent message found in history for lead ${input.to_email} in campaign ${input.campaign_id}`);
      }
    }

    // KROK 2: Kontrola klasifikácie — ak nie je Interested, končíme
    if (classification !== 'POSITIVE') {
      const result: AutomationResult<SmartleadOutput> = {
        success: true,
        data: {
          leadEmail: input.to_email,
          replySent: false,
          aiReply: `Skipped: Reply classified as ${classification}`,
          smartleadResponseStatus: 0,
          usedEmailStatsId: messageData.email_stats_id,
          dry_run: input.dry_run ?? false,
        },
        durationMs: Date.now() - ctx.startTime,
      };
      await logRun(ctx, result, input);
      return result;
    }

    // KROK 3: Vygeneruj AI odpoveď
    const leadReplyBody = input.email_body ?? '';
    const aiReply = await generateReply({
      leadEmail: input.to_email,
      leadName: input.lead_name,
      leadReplyBody,
      history: messageData.history || [],
      senderEmail: messageData.sender_email,
      senderName: messageData.sender_name,
    });

    // KROK 3: Odošli odpoveď cez Smartlead API
    if (input.dry_run) {
      // Preskočíme odoslanie — vrátime čo by sme odoslali
      const result: AutomationResult<SmartleadOutput> = {
        success: true,
        data: {
          leadEmail: input.to_email,
          replySent: false,
          aiReply,
          smartleadResponseStatus: 0,
          usedEmailStatsId: messageData.email_stats_id,
          dry_run: true,
        },
        durationMs: Date.now() - ctx.startTime,
      };
      await logRun(ctx, result, input);
      return result;
    }

    const sendResult = await sendSmartleadReply({
      campaignId: input.campaign_id,
      emailStatsId: messageData.email_stats_id,
      replyMessageId: messageData.reply_message_id,
      replyEmailTime: messageData.reply_email_time,
      emailBody: aiReply,
    });

    const result: AutomationResult<SmartleadOutput> = {
      success: true,
      data: {
        leadEmail: input.to_email,
        replySent: sendResult.status >= 200 && sendResult.status < 300,
        aiReply,
        smartleadResponseStatus: sendResult.status,
        usedEmailStatsId: messageData.email_stats_id,
        dry_run: false,
      },
      durationMs: Date.now() - ctx.startTime,
    };

    await logRun(ctx, result, input);

    // KROK 4: Zápis do DB o úspešnom odoslaní (iba ak nie je dry-run)
    if (!input.dry_run && result.success && result.data?.replySent) {
      try {
        await sql`
          INSERT INTO sent_replies (lead_email, campaign_id)
          VALUES (${input.to_email}, ${input.campaign_id})
          ON CONFLICT (lead_email, campaign_id) DO NOTHING
        `;
      } catch (e) {
        console.error("Failed to record sent reply in DB:", e);
      }
    }

    return result;

  } catch (error: any) {
    const result: AutomationResult<SmartleadOutput> = {
      success: false,
      error: error.message,
      durationMs: Date.now() - ctx.startTime,
    };
    await logRun(ctx, result, input);
    throw error;
  }
}

// --- Pomocné funkcie ---

interface MessageData {
  email_stats_id: string;
  reply_message_id: string;
  reply_email_time: string;
  history: any[];
  sender_email?: string;
  sender_name?: string;
}

async function fetchMessageHistory(campaignId: string, leadEmail: string, preferredSenderEmail?: string): Promise<MessageData | null> {
  const baseUrl = 'https://server.smartlead.ai/api/v1';

  // 1. Získať lead_id vyhľadaním leada podľa emailu
  const leadLookupRes = await fetchTool({
    url: `${baseUrl}/leads/?api_key=${env.SMARTLEAD_API_KEY}&email=${encodeURIComponent(leadEmail)}`,
    method: 'GET'
  });

  if (leadLookupRes.status !== 200) {
    console.error(`Smartlead lead lookup API returned ${leadLookupRes.status}`);
  }

  const data = leadLookupRes.status === 200 ? leadLookupRes.data as any : { data: [] };
  const leads = Array.isArray(data) ? data : (data.id ? [data] : (data.data || []));

  let smartleadMessages: any[] = [];
  let leadMapId: string | undefined;

  if (leads.length > 0) {
      // Nájdeme leada patriaceho pod správnu kampaň, alebo použijeme aspoň prvého
      const targetLead = leads.find((l: any) => l.campaign_id == campaignId) || leads[0];
      leadMapId = targetLead.id || targetLead.campaign_lead_map_id;

      if (leadMapId) {
          const historyUrl = `${baseUrl}/campaigns/${campaignId}/leads/${leadMapId}/message-history`;
          const result = await fetchTool({
              url: `${historyUrl}?api_key=${env.SMARTLEAD_API_KEY}`,
              method: 'GET',
          });
          if (result.status === 200) {
              const resData = result.data as any;
              smartleadMessages = Array.isArray(resData) ? resData : (resData.data || resData.history || resData.messages || []);
          }
      }
  }

  // 2. Skúsiť Gmail históriu
  const senderEmailForGmail = preferredSenderEmail || 
    smartleadMessages.find((m: any) => m.from_email || m.from)?.from_email || 
    smartleadMessages.find((m: any) => m.from_email || m.from)?.from;

  let gmailMessages: any[] = [];
  if (senderEmailForGmail) {
      console.log(`📡 Fetching Gmail history for ${leadEmail} from ${senderEmailForGmail}...`);
      const gmailHistory = await fetchGmailHistory(leadEmail, senderEmailForGmail);
      gmailMessages = gmailHistory.map((m: any) => ({
          email_body: m.body,
          subject: m.subject,
          from_email: m.from,
          type: m.isMe ? 'EMAIL_SENT' : 'EMAIL_REPLY',
          send_time: m.date,
          isGmail: true
      }));
  }

  // 3. Spojiť histórie a zmazať duplicity (podľa času a textu - približne)
  const combinedHistory = [...smartleadMessages, ...gmailMessages].sort((a, b) => 
    new Date(a.send_time || a.created_at).getTime() - new Date(b.send_time || b.created_at).getTime()
  );

  // 4. Extrahovať dáta pre Smartlead reply (potrebujeme stats_id a message_id z posledného SENT v Smartleade)
  const sentMessages = smartleadMessages
    .map((m: unknown) => {
      const parsed = messageHistoryItemSchema.safeParse(m);
      return parsed.success ? parsed.data : null;
    })
    .filter((m: any): m is NonNullable<typeof m> =>
      m !== null &&
      (m.type === 'EMAIL_SENT' || m.type === 'SENT') &&
      Boolean(m.stats_id) &&
      Boolean(m.message_id)
    );

  if (sentMessages.length === 0) {
      // Ak nemáme Smartlead históriu, nemôžeme odpovedať cez Smartlead API thread
      // Ale môžeme aspoň vrátiť históriu pre AI ak existuje Gmail
      if (combinedHistory.length > 0) {
          return {
              email_stats_id: '',
              reply_message_id: '',
              reply_email_time: '',
              history: combinedHistory,
              sender_email: senderEmailForGmail,
              sender_name: senderEmailForGmail?.split('@')[0] || 'ME'
          };
      }
      return null;
  }

  const lastSent = sentMessages[sentMessages.length - 1];
  let senderName = (lastSent as any).from_name;
  const senderEmail = lastSent.from_email || (lastSent as any).from;

  if (!senderName && senderEmail) {
    const prefix = senderEmail.split('@')[0].split('.')[0];
    senderName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }

  return {
    email_stats_id: lastSent.stats_id!,
    reply_message_id: lastSent.message_id!,
    reply_email_time: lastSent.send_time ?? lastSent.created_at ?? new Date().toISOString(),
    history: combinedHistory,
    sender_email: senderEmail,
    sender_name: senderName || 'Andrej',
  };
}

async function classifyReply(replyBody: string, history: any[] = [], senderName: string = 'ME'): Promise<'POSITIVE' | 'NEGATIVE' | 'ALREADY_SENT' | 'NEUTRAL'> {
  const formattedHistory = history
    .sort((a: any, b: any) => new Date(a.send_time || a.created_at).getTime() - new Date(b.send_time || b.created_at).getTime())
    .map((m: any) => {
      const isLead = (m.type === 'EMAIL_REPLY' || m.type === 'REPLY');
      const sender = isLead ? 'LEAD' : senderName;
      const body = m.email_body.replace(/<[^>]*>/g, ' ').trim();
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
  // Skús z lead_name
  if (leadName) {
    const parts = leadName.trim().split(/\s+/);
    if (parts.length >= 2) return parts[parts.length - 1]; // posledné slovo = priezvisko
  }
  
  // Skús zo signatúry emailu
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
        return nameParts[nameParts.length - 1]; // priezvisko
      }
    }
  }
  
  return ''; // nič nenašlo → použije sa "Dobrý deň,"
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
  const senderName = input.senderName || 'Andrej';

  // Formátovanie histórie pre AI
  const formattedHistory = input.history
    .sort((a: any, b: any) => new Date(a.send_time || a.created_at).getTime() - new Date(b.send_time || b.created_at).getTime())
    .map((m: any) => {
      const isLead = (m.type === 'EMAIL_REPLY' || m.type === 'REPLY');
      const sender = isLead ? 'LEAD' : senderName;
      const body = m.email_body.replace(/<[^>]*>/g, ' ').trim();
      return `[${sender}]: ${body}`;
    })
    .join('\n---\n');

  const systemPrompt = `You are a male professional sales assistant named ${senderName} responding to cold email replies on behalf of Arcigy.
Write a short, warm, formal reply ALWAYS in Slovak language.

Rules:
- You are writing as ${senderName} (${input.senderEmail || 'andrej.r@arcigy.group'}).
- Use formal address: "Dobrý deň pani/pán [Priezvisko],"
- Extract surname: second word from lead_name, or from email signature if lead_name unavailable
- If no name found at all: use "Dobrý deň,"
- Use first-person singular (JA - I) for the entire response. Use masculine forms (e.g., "rád" instead of "rada"). For example: "Rád Vám pomôžem" instead of "Radi Vám pomôžeme".
- CONTEXT: You have the full conversation history. Use it to sound natural and consistent with ${senderName}'s previous messages.
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

interface SendReplyInput {
  campaignId: string;
  emailStatsId: string;
  replyMessageId: string;
  replyEmailTime: string;
  emailBody: string;
}

async function sendSmartleadReply(input: SendReplyInput) {
  return fetchTool({
    url: `https://server.smartlead.ai/api/v1/campaigns/${input.campaignId}/reply-email-thread?api_key=${env.SMARTLEAD_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      email_stats_id: input.emailStatsId,
      email_body: input.emailBody,
      reply_message_id: input.replyMessageId,
      reply_email_time: input.replyEmailTime,
    },
  });
}
