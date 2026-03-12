import { sql } from "../core/db";

async function fixNicheIds() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704"; // Auto Servis
  
  console.log(`🛠️ Priraďujem ${nicheId} k leadom bez niche...`);
  
  const result = await sql`
    UPDATE leads 
    SET niche_id = ${nicheId}
    WHERE niche_id IS NULL
    RETURNING id
  `;

  console.log(`✅ Úspešne priradených ${result.length} leadov.`);

  const finalCheck = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND primary_email IS NOT NULL AND icebreaker_sentence IS NOT NULL AND sent_to_smartlead = false) as ready_to_send
    FROM leads
    WHERE niche_id = ${nicheId}
  `;

  console.log(`🚀 Aktuálne pripravených na odoslanie: ${finalCheck[0].ready_to_send}`);
  process.exit(0);
}

fixNicheIds().catch(console.error);
