import { geminiCallTool } from "../tools/ai/gemini-call.tool";

// Simulácia funkcií z handlera pre čistý test bez Smartleadu
async function simulateClassify(replyBody: string, history: any[], senderName: string = 'Branislav') {
  const formattedHistory = history
    .map((m: any) => `[${m.isMe ? senderName : 'LEAD'}]: ${m.body}`)
    .join('\n---\n');

  const systemPrompt = `You are an expert sales assistant for Arcigy. Your job is to classify if a lead wants to see a demo/showcase link.
Categories:
- POSITIVE: The lead explicitly expresses interest or says "yes" to seeing the showcase. Examples: "ok", "pošlite", "zaujíma ma to", "skúsme", "môžete poslať", "send it", "please send", "sure".
- NEGATIVE: The lead is NOT interested or declines the offer.
- ALREADY_SENT: The lead asks for the link, but in the history you see that [${senderName}] ALREADY sent a link (https://www.arcigy.com/showcase) AFTER their previous inquiry.
- NEUTRAL: Just saying "thank you", asking a technical question without interest, or "out of office" replies.
Reply ONLY with the category name.`;

  const userMessage = `CONVERSATION HISTORY:\n${formattedHistory}\n\nLATEST LEAD REPLY:\n"${replyBody}"`;

  const result = await geminiCallTool({
    systemPrompt,
    userMessage,
    model: 'gemini-2.5-flash',
    maxTokens: 100,
  });
  return result.content.trim().toUpperCase();
}

async function simulateGenerate(replyBody: string, history: any[], surname: string, senderName: string = 'Branislav') {
  const formattedHistory = history
    .map((m: any) => `[${m.isMe ? senderName : 'LEAD'}]: ${m.body}`)
    .join('\n---\n');

  const systemPrompt = `You are a male professional sales assistant named ${senderName} responding to cold email replies on behalf of Arcigy.
Write a short, warm, formal reply ALWAYS in Slovak language.
Rules:
- Use formal address: "Dobrý deň pán/pani ${surname || ''},"
- Use first-person singular (JA - I). Use masculine forms.
- Maximum 3 sentences. Professional but warm.
- Always include the link and refer to it as "ukážka" (showcase).
- Link: <a href='https://www.arcigy.com/showcase'>https://www.arcigy.com/showcase</a>
- Format as simple HTML with <br><br>. No signature.`;

  const userMessage = `History:\n${formattedHistory}\n\nLatest reply: "${replyBody}"\n\nWrite the reply now.`;

  const result = await geminiCallTool({
    systemPrompt,
    userMessage,
    model: 'gemini-2.5-flash',
    maxTokens: 1000,
  });
  return result.content.trim();
}

const scenarios = [
  {
    name: "1. Jasný záujem",
    leadReply: "Dobrý deň, to znie super. Pošlite mi prosím tú ukážku.",
    history: [{ isMe: true, body: "Dobrý deň, robíme automatizácie... Chceli by ste vidieť ukážku?" }],
    surname: "Kováč"
  },
  {
    name: "2. Odmietnutie (Negatívne)",
    leadReply: "Nemám záujem, vymažte ma.",
    history: [{ isMe: true, body: "Dobrý deň, robíme automatizácie... Chceli by ste vidieť ukážku?" }],
    surname: "Varga"
  },
  {
    name: "3. Otázka na cenu (Pozitívne)",
    leadReply: "Zaujímavé. Koľko takéto niečo stojí? Môžete mi poslať viac info?",
    history: [{ isMe: true, body: "Dobrý deň... Chceli by ste vidieť ukážku?" }],
    surname: "Molnár"
  },
  {
    name: "4. Už bolo poslané (Already Sent)",
    leadReply: "Viete mi to poslať ešte raz? Stratil som ten link.",
    history: [
      { isMe: true, body: "Dobrý deň... Chceli by ste vidieť?" },
      { isMe: false, body: "Áno." },
      { isMe: true, body: "Tu je link: https://www.arcigy.com/showcase" }
    ],
    surname: "Tóth"
  },
  {
    name: "5. Human Check (Stopka) - Manuálna odpoveď",
    leadReply: "Môžete mi to poslať?",
    history: [
      { isMe: true, body: "Cold email..." },
      { isMe: false, body: "Zaujíma ma to." },
      { isMe: true, body: "Odpisujem ti manuálne: Jasná vec, hneď to pošlem." } // Toto je stopka
    ],
    surname: "Fekete"
  },
  {
    name: "6. Followup situácia (Nespúšťa stopku)",
    leadReply: "Jasné, pošlite.",
    history: [
      { isMe: true, body: "Cold email..." },
      { isMe: true, body: "Followup: Ešte raz sa pripomínam..." } // Toto nie je stopka, lebo lead ešte neodpovedal
    ],
    surname: "Nagy"
  },
  {
    name: "7. Technická otázka (Neutrálne)",
    leadReply: "Používate na to Make alebo Python?",
    history: [{ isMe: true, body: "Robíme automatizácie..." }],
    surname: "Horváth"
  },
  {
    name: "8. Out of Office",
    leadReply: "I am out of office until next Monday. Please contact my colleague.",
    history: [{ isMe: true, body: "Chceli by ste vidieť ukážku?" }],
    surname: ""
  },
  {
    name: "9. Žiadosť o hovor",
    leadReply: "Môžeme si o tom zavolať v utorok? Alebo mi pošlite nejaké podklady vopred.",
    history: [{ isMe: true, body: "Chceli by ste vidieť ukážku?" }],
    surname: "Krajčír"
  },
  {
    name: "10. Odpoveď kolegovi",
    leadReply: "Pošlite to radšej mojim kolegom na info@firma.sk, oni to riešia.",
    history: [{ isMe: true, body: "Chceli by ste vidieť ukážku?" }],
    surname: "Baláž"
  }
];

import * as fs from 'fs';

async function runSuite() {
  const finalResults = [];
  console.log("🧪 TEST SUITE: AI REPLY AUTOMATION\n");
  
  for (const s of scenarios) {
    const resultObj: any = {
      scenario: s.name,
      leadMessage: s.leadReply,
      status: '',
      category: '',
      aiReply: ''
    };
    
    // Check Human Stopka manually in test logic
    const lastHistoryItem = s.history[s.history.length - 1];
    const leadHasRepliedBefore = s.history.some(m => !m.isMe);
    const stopka = leadHasRepliedBefore && lastHistoryItem.isMe;

    if (stopka) {
      resultObj.status = 'SKIP (Stopka - detegovaná manuálna odpoveď)';
      finalResults.push(resultObj);
      continue;
    }

    const cat = await simulateClassify(s.leadReply, s.history);
    resultObj.category = cat;
    
    if (cat.includes("POSITIVE")) {
      const reply = await simulateGenerate(s.leadReply, s.history, s.surname);
      resultObj.status = 'AI_REPLIED';
      resultObj.aiReply = reply;
    } else {
      resultObj.status = `SKIP (${cat})`;
    }
    
    finalResults.push(resultObj);
  }

  let mdContent = '# Výsledky simulácie AI Odpovedí\n\n';
  finalResults.forEach(r => {
    mdContent += `## ${r.scenario}\n`;
    mdContent += `**Lead:** "${r.leadMessage}"\n\n`;
    mdContent += `**Klasifikácia / Status:** ${r.status}\n\n`;
    if (r.aiReply) {
      mdContent += `**AI Odpoveď:**\n\n\`\`\`html\n${r.aiReply}\n\`\`\`\n\n`;
    }
    mdContent += `---\n\n`;
  });

  fs.writeFileSync('test_results.md', mdContent, 'utf-8');
  console.log("✅ Hotovo. Výsledky uložené do test_results.md");
}

runSuite().catch(console.error);
