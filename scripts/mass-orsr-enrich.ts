import { sql } from "../core/db";
import { orsrMasterLookup } from "../tools/scraping/orsr-scraper.tool";

async function massOrsrEnrich() {
  const nicheId = "67f96b96-6de3-4abf-a5dc-ebadbf547704"; // Auto Servis
  
  console.log(`🚀 Spúšťam masívny ORSR enrichment pre niche: ${nicheId}`);
  
  const leads = await sql`
    SELECT id, website, original_name, official_company_name, ico 
    FROM leads 
    WHERE niche_id = ${nicheId} 
    AND (ico IS NULL OR official_company_name IS NULL)
  `;

  console.log(`🔍 Nájdených ${leads.length} leadov na doplnenie.`);

  for (const lead of leads) {
    try {
      console.log(`Processing: ${lead.website}...`);
      
      // Skúsime nájsť dáta podľa mena (keďže IČO nemáme)
      const data = await orsrMasterLookup({
        companyName: lead.official_company_name || lead.original_name
      });

      if (data) {
        console.log(`  ✅ Nájdené: ${data.companyName} (IČO: ${data.ico})`);
        await sql`
          UPDATE leads 
          SET 
            ico = ${data.ico},
            official_company_name = ${data.companyName},
            address = ${data.address},
            updated_at = now()
          WHERE id = ${lead.id}
        `;
      } else {
        console.log(`  ❌ Nenájdené v registroch.`);
      }
      
      // Polite delay
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error(`  🔥 Chyba pri ${lead.website}: ${err.message}`);
    }
  }

  console.log("✅ Masívny enrichment dokončený.");
  process.exit(0);
}

massOrsrEnrich().catch(console.error);
