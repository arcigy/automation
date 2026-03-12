import { handler } from "../automations/lead-enricher/handler";
import { sql } from "../core/db";

async function runBatchEnrichment() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("🚀 STARTING AUTOMATIC BATCH LEADS ENRICHMENT");
  console.log("══════════════════════════════════════════════════════════════\n");

  try {
    // Získaj leady, ktoré si vyžadujú enrichment. 
    // Berieme tie, ktoré nemajú overené ORSR alebo im chýbajú zásadné dáta.
    // Dáme limit 5 pre tento bezobslužný batch test.
    const leadsToEnrich = await sql`
      SELECT website, original_name
      FROM leads
      WHERE orsr_verified IS NOT TRUE
      AND (verification_status IS NULL OR verification_status != 'failed')
    `;

    if (leadsToEnrich.length === 0) {
      console.log("🎉 Žiadne ďalšie leady na obohatenie nenájdené. Všetko je aktuálne.");
      process.exit(0);
    }

    console.log(`📡 Nájdených ${leadsToEnrich.length} leadov na spracovanie.\n`);

    for (let i = 0; i < leadsToEnrich.length; i++) {
        const lead = leadsToEnrich[i];
        console.log(`\n[${i + 1}/${leadsToEnrich.length}] Spracovávam: ${lead.website} (${lead.original_name})`);
        
        try {
            // Handler zvláda celý flow (Scrape -> AI -> ORSR -> ZRSR -> DB Insert)
            // Posielame im to po jednom sekvenčne, aby sme sa vyhli pretlačeniu premenných v RAM a rate limits.
            const result = await handler({
                leads: [{
                    name: lead.original_name,
                    website: lead.website
                }],
                aggressive_scraping: true,
                campaign_tag: "auto_batch_enrich"
            });

            if (result.success) {
                const data = result.data?.leads[0];
                console.log(`✅ HOTOVO pre ${lead.website}:`);
                console.log(`   🔸 IČO: ${data?.ico || "Nenájdené"}`);
                console.log(`   🔸 Firma: ${data?.official_company_name || data?.company_name_short || "Nenájdené"}`);
                console.log(`   🔸 Konateľ: ${data?.decision_maker_name || "Nenájdený"}`);
                console.log(`   🔸 Email: ${data?.email || "Nenájdený"}`);
                console.log(`   🔸 Zdroj potvrdenia: ${data?.orsr_verified ? "ORSR/ZRSR" : "Iba AI"}`);
            } else {
                console.error(`❌ ZLYHANIE handlera pre ${lead.website}: ${result.error}`);
            }
        } catch (err: any) {
            console.error(`💥 KRITICKÁ CHYBA pri lead-e ${lead.website}: ${err.message}`);
        }

        // Oddych po každom leade, aby nás API servery (Gemini/ORSR) neblokli
        if (i < leadsToEnrich.length - 1) {
            console.log("⏳ Čakám 5 sekúnd pred ďalším leadom pre ochranu rate limitov...");
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("✅ BATCH ENRICHMENT ÚSPEŠNE DOKONČENÝ");
    console.log("══════════════════════════════════════════════════════════════");
    process.exit(0);

  } catch (error) {
    console.error("💥 KRITICKÁ CHYBA GLOBÁLNEHO SKRIPTU:", error);
    process.exit(1);
  }
}

runBatchEnrichment();
