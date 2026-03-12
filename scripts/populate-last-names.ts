import { sql } from "../core/db";

async function populateLastNames() {
  console.log("🚀 Populating decision_maker_last_name for existing leads...");
  
  const leads = await sql`
    SELECT id, decision_maker_name 
    FROM leads 
    WHERE decision_maker_name IS NOT NULL AND decision_maker_name != ''
    AND (decision_maker_last_name IS NULL OR decision_maker_last_name = '')
  `;

  console.log(`🔍 Found ${leads.length} leads to update.`);

  for (const lead of leads) {
    const full = lead.decision_maker_name.trim();
    const parts = full.split(/\s+/).filter((p: string) => !p.includes("."));
    const firstName = parts[0] || "";
    // Real last name (including academic suffixes like PhD. if any? NO, they usually use spaces)
    const surParts = full.split(/\s+/);
    const last = surParts[surParts.length - 1];

    const isFemale = last.toLowerCase().endsWith("á") || last.toLowerCase().endsWith("ová") || last.toLowerCase().endsWith("eva");
    const salutation = isFemale ? "pani" : "pán";
    const formatted = ` ${salutation} ${last}`;

    await sql`UPDATE leads SET decision_maker_last_name = ${formatted} WHERE id = ${lead.id}`;
  }

  console.log("✅ Done.");
  process.exit(0);
}

populateLastNames().catch(console.error);
