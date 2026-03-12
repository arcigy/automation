import { sql } from "../core/db";
import { geminiCallTool } from "../tools/ai/gemini-call.tool";
import { webScraperTool } from "../tools/scraping/web-scraper.tool";

async function generateMissingIcebreakers() {
  console.log("🚀 Spúšťam PORIADNE generovanie icebreakerov cez Gemini 2.5-flash...");
  
  // Nájdi tie, ktoré sú naozaj zlé - buď prázdne, alebo tie "nepodarky"
  const leads = await sql`
    SELECT id, website, original_name, official_company_name, business_facts
    FROM leads 
    WHERE primary_email IS NOT NULL 
    AND primary_email != ''
    AND (
      icebreaker_sentence IS NULL 
      OR icebreaker_sentence = '' 
      OR icebreaker_sentence = '...' 
      OR icebreaker_sentence LIKE 'V srdci Slovenska%'
      OR icebreaker_sentence LIKE 'Prešovské cesty%'
      OR icebreaker_sentence LIKE 'Udržiavame vaše%'
      OR LENGTH(icebreaker_sentence) < 30
    )
    LIMIT 20
  `;

  console.log(`🔍 Nájdených ${leads.length} leadov na opravu.`);

  for (const lead of leads) {
    try {
      const name = lead.official_company_name || lead.original_name || "firma";
      console.log(`\n---------------------------------------------------------`);
      console.log(`🌐 Spracovávam: ${name} (${lead.website})`);
      
      // 1. Scraping webu (pôjdeme do hĺbky pre viac dát)
      console.log(`🕵️‍♂️ Scrapujem web s hĺbkou 1...`);
      const scrapedPages = await webScraperTool({ url: lead.website, depth: 1 });
      const contextText = scrapedPages.map(p => `--- STRÁNKA: ${p.url} ---\n${p.text}`).join("\n\n").substring(0, 7000);
      
      // 2. Tvorba icebreakeru pomocou GEMINI-2.5-FLASH
      console.log(`🤖 Volám model GEMINI-2.5-FLASH...`);
      
      const systemPrompt = `Si elitný B2B copywriter. Tvojou úlohou je napísať úvodnú vetu (icebreaker) pre email majiteľovi autoservisu.

Pravidlá:
1. Jazyk: SLOVENČINA.
2. Formát: Presne 1 veta. Žiadne "Dobrý deň", žiadne placeholder texty.
3. Musíš použiť ŠPECIFICKÝ fakt z textu webu:
   - Značky (napr. BMW, VW Škoda...), ktorým sa venujú.
   - Služby (napr. plnenie klímy, servis prevodoviek, pneuservis...).
   - Niečo o tradícii (rok vzniku, rodinný podnik).
   - Lokalita v kontexte ich služieb.
4. ABSOLÚTNE ZAKÁZANÉ sú generické frázy typu "Udržiavame vaše", "Srdce Slovenska", "Váš web ma zaujal".
5. Ak nemáš dosť dát z webu, skús vymyslieť vetu o ich profesionálnom vystupovaní v danom regióne.

Dôraz: Veta musí znieť tak, aby majiteľ vedel, že si naozaj videl jeho web.`;

      const userMessage = `Firma: ${name}
Webstránka: ${lead.website}
Text z webu:
${contextText || "Web sa nepodarilo naskrapovať."}
---
Pôvodné fakty: ${lead.business_facts ? JSON.stringify(lead.business_facts) : "žiadne"}`;

      const aiResponse = await geminiCallTool({
        systemPrompt,
        userMessage,
        model: "gemini-2.5-flash",
        maxTokens: 250
      });

      const sentence = aiResponse.content.trim().replace(/^"|"$/g, '');

      if (sentence && sentence.length > 25) {
        console.log(`✅ NOVÝ ICEBREAKER: ${sentence}`);
        await sql`
          UPDATE leads 
          SET 
            icebreaker_sentence = ${sentence}, 
            updated_at = now()
          WHERE id = ${lead.id}
        `;
        console.log(`💾 Uložené.`);
      } else {
        console.log(`⚠️ AI vygenerovalo slabú vetu, preskakujem: "${sentence}"`);
      }

      await new Promise(r => setTimeout(r, 800));

    } catch (err: any) {
      console.error(`🔥 Chyba: ${err.message}`);
    }
  }

  console.log("\n✅ Poriadne generovanie cez Gemini-2.5 hotové.");
  process.exit(0);
}

generateMissingIcebreakers().catch(console.error);
