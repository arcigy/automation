import { sql } from "../core/db";

async function populateEveryLastName() {
  console.log("🚀 AGGRESSIVE population of decision_maker_last_name...");
  
  // Get ALL leads with a name, ignoring if last_name is already set
  const leads = await sql`
    SELECT id, decision_maker_name 
    FROM leads 
    WHERE decision_maker_name IS NOT NULL AND decision_maker_name != ''
  `;

  console.log(`🔍 Total leads to process: ${leads.length}`);

  let updated = 0;
  for (const lead of leads) {
    const full = lead.decision_maker_name.trim();
    
    // Improved detection: skip academic titles and find real last name
    const parts = full.split(/\s+/);
    // Remove purely academic parts like Ing., Mgr., PhD., Bc., doc., prof., Dr.
    const filteredParts = parts.filter((p: string) => {
        const lp = p.toLowerCase().replace(/[.,]/g, '');
        return !['ing', 'mgr', 'phd', 'bc', 'doc', 'prof', 'dr', 'mudr', 'judr', 'rdr', 'paeddr'].includes(lp);
    });

    if (filteredParts.length < 1) continue;

    const first = filteredParts[0];
    const last = filteredParts[filteredParts.length - 1];

    // Gender detection logic
    const isFemale = last.toLowerCase().endsWith("á") || 
                     last.toLowerCase().endsWith("ová") || 
                     last.toLowerCase().endsWith("eva") ||
                     last.toLowerCase().endsWith("ská"); // Often female variant of -ský is -ská

    const salutation = isFemale ? "pani" : "pán";
    const formatted = `${salutation} ${last}`;

    await sql`
      UPDATE leads 
      SET decision_maker_last_name = ${formatted} 
      WHERE id = ${lead.id}
    `;
    updated++;
  }

  console.log(`✅ Success! Updated ${updated} leads.`);
  process.exit(0);
}

populateEveryLastName().catch(console.error);
