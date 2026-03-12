import { sql } from "../core/db";
import { handler } from "../automations/lead-enricher/handler";

/**
 * Tento script prejde existujúce leady v databáze, ktoré ešte nemajú doplnené IČO
 * a znova ich preženie AI procesom (re-enrichment).
 */

async function enrichExisting() {
    try {
        console.log("🚀 Hľadám leady bez IČO na doplnenie...");
        
        // Získame leady, ktoré nemajú IČO a neboli označené ako zlyhané predtým (alebo všetky ak chceme refresh)
        const leadsToProcess = await sql`
            SELECT original_name as name, website, campaign_tag
            FROM leads
            WHERE ico IS NULL AND verification_status != 'failed'
            LIMIT 50 -- Spracujeme po menších dávkach aby sme nepreťažili API
        `;

        if (leadsToProcess.length === 0) {
            console.log("✅ Všetky leady už majú IČO alebo sú v stave 'failed'.");
            return;
        }

        console.log(`🔍 Našiel som ${leadsToProcess.length} leadov. Spúšťam doplňovanie...`);

        // Voláme priamo handler s týmito leadmi
        const result = await handler({
            leads: leadsToProcess,
            aggressive_scraping: true,
            campaign_tag: leadsToProcess[0].campaign_tag // Ponecháme pôvodný tag
        });

        if (result.success) {
            console.log(`\n✅ ÚSPEŠNE DOPLNENÉ: ${result.data?.leads.length} leadov bolo znova spracovaných.`);
            console.log("Teraz môžeš spustiť synchronizáciu do Google Sheets.");
        } else {
            console.log("❌ Enrichment zlyhal:", result.error);
        }

    } catch (e: any) {
        console.error("❌ Kritická chyba:", e.message);
    } finally {
        await sql.end();
    }
}

enrichExisting();
