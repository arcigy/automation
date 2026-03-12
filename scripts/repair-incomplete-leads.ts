import { sql } from "../core/db";
import { handler as enrichHandler } from "../automations/lead-enricher/handler";

async function repair() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704"; // Auto Servis
  
  console.log("🔍 Sťahujem neúplné leady pre opravu...");
  
  // Leady, ktorým chýba meno ALEBO email ALEBO icebreaker
  const leadsToRepair = await sql`
    SELECT website, original_name as name 
    FROM leads 
    WHERE niche_id = ${nicheId}
    AND (decision_maker_name IS NULL OR decision_maker_name = '' OR primary_email IS NULL OR primary_email = '' OR icebreaker_sentence IS NULL)
    LIMIT 20
  `;

  if (leadsToRepair.length === 0) {
    console.log("✅ Žiadne neúplné leady na opravu.");
    process.exit(0);
  }

  console.log(`🚀 Začínam opravovať ${leadsToRepair.length} leadov...`);
  
  await enrichHandler({
    leads: leadsToRepair,
    campaign_tag: "repair_auto_servis"
  });

  console.log("✅ Oprava dokončená.");
  process.exit(0);
}

repair().catch(console.error);
