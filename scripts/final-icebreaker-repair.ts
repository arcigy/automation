import { sql } from "../core/db";
import { geminiCallTool } from "../tools/ai/gemini-call.tool";

async function repair() {
  const ids = [
    '48014291-f90a-4d79-82bc-737271347c27a6567',
    '811692a0-ab4a-4c24-71aa-6d1d8b4a3960cb6',
    '1f98ac2b-4780-4a52-9ec0-1347c27a6567',
    'acb2346-7980-4a52-9ec0-1347c27a6567'
  ];

  console.log(`Starting repair for ${ids.length} specific IDs...`);

  for (const id of ids) {
    const lead = await sql`SELECT id, website, original_name, official_company_name FROM leads WHERE id = ${id}`;
    if (lead.length === 0) {
      console.log(`ID ${id} not found in DB!`);
      continue;
    }

    const l = lead[0];
    const name = l.official_company_name || l.original_name || "firma";
    
    console.log(`Generating for ${l.website}...`);
    
    const res = await geminiCallTool({
      systemPrompt: "Si B2B copywriter. Napíš 1 krátku úvodnú vetu pre slovenskú firmu. MAX 1 VETA. Slovenčina.",
      userMessage: `Firma: ${name}, Web: ${l.website}`,
      model: "gemini-2.5-flash"
    });

    const sentence = res.content.trim().replace(/^"|"$/g, '');
    console.log(`  Update: ${sentence}`);

    await sql`UPDATE leads SET icebreaker_sentence = ${sentence} WHERE id = ${id}`;
  }

  process.exit(0);
}

repair().catch(console.error);
