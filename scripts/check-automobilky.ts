import { sql } from "../core/db";

async function checkAutomobilky() {
  console.log("🔍 Kontrolujem niche 'automobile'...");
  
  const niches = await sql`
    SELECT id, name, slug 
    FROM niches 
    WHERE name ILIKE '%auto%' OR slug ILIKE '%auto%'
  `;

  if (niches.length === 0) {
    console.log("❌ Niche pre automobilky nebola nájdená.");
    process.exit(0);
  }

  for (const niche of niches) {
    console.log(`\n--- Niche: ${niche.name} (${niche.slug}) ---`);
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND decision_maker_name != '') as has_name,
        COUNT(*) FILTER (WHERE primary_email IS NOT NULL AND primary_email != '') as has_email,
        COUNT(*) FILTER (WHERE icebreaker_sentence IS NOT NULL AND icebreaker_sentence != '') as has_icebreaker,
        COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND primary_email IS NOT NULL AND icebreaker_sentence IS NOT NULL AND sent_to_smartlead = false) as ready_to_send
      FROM leads
      WHERE niche_id = ${niche.id}
    `;

    const s = stats[0];
    console.log(`  - Celkovo v DB: ${s.total}`);
    console.log(`  - Má meno DM: ${s.has_name}`);
    console.log(`  - Má email: ${s.has_email}`);
    console.log(`  - Má icebreaker: ${s.has_icebreaker}`);
    console.log(`  - 🚀 PRIPRAVENÉ NA ODOSLANIE: ${s.ready_to_send}`);
  }

  process.exit(0);
}

checkAutomobilky().catch(err => {
  console.error(err);
  process.exit(1);
});
