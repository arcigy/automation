import { sql } from "../core/db";
import { orsrMasterLookup } from "../tools/scraping/orsr-scraper.tool";

async function enrichOrsrNames() {
  console.log("🚀 Spúšťam ORSR scraper pre leadov s IČO bez mena majiteľa...");
  
  const targetLeads = await sql`
    SELECT id, website, ico, official_company_name, original_name
    FROM leads 
    WHERE ico IS NOT NULL AND ico != ''
    AND (decision_maker_name IS NULL OR decision_maker_name = '')
  `;

  console.log(`🔍 Nájdených ${targetLeads.length} cieľov.`);

  for (const lead of targetLeads) {
    try {
      console.log(`Scraping: ${lead.website} (IČO: ${lead.ico})...`);
      
      const data = await orsrMasterLookup({
        ico: lead.ico,
        companyName: lead.official_company_name || lead.original_name
      });

      if (data && data.executives && data.executives.length > 0) {
        const ownerName = data.executives[0];
        console.log(`  ✅ Nájdené meno: ${ownerName}`);
        
        // Split name for last name and salutation
        const nameParts = ownerName.trim().split(/\s+/).filter(p => !p.includes(".")); // Ignore Ing., Mgr., etc.
        const firstName = nameParts[0] || "";
        const lastName = nameParts[nameParts.length - 1] || "";
        
        const sur = ownerName.trim().split(/\s+/);
        const realLast = sur[sur.length - 1];
        
        const salutation = firstName && realLast ? (
          (realLast.toLowerCase().endsWith("á") || realLast.toLowerCase().endsWith("ová") || realLast.toLowerCase().endsWith("eva")) ? "pani" : "pán"
        ) : "pán";

        const lastNameFormatted = ` ${salutation} ${realLast}`;

        await sql`
          UPDATE leads 
          SET 
            decision_maker_name = ${ownerName},
            decision_maker_last_name = ${lastNameFormatted},
            official_company_name = ${data.companyName || lead.official_company_name},
            orsr_verified = true,
            updated_at = now()
          WHERE id = ${lead.id}
        `;
      } else {
        console.log(`  ❌ Meno v registri nenájdené.`);
      }

      await new Promise(r => setTimeout(r, 1000)); // Polite delay
    } catch (err: any) {
      console.error(`  🔥 Chyba: ${err.message}`);
    }
  }

  console.log("✅ Hotovo.");
  process.exit(0);
}

enrichOrsrNames().catch(console.error);
