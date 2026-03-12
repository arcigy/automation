import { sql } from "../core/db";
import { orsrGetByIco } from "../tools/scraping/orsr-scraper.tool";

async function deepEnrich() {
    try {
        console.log("🔍 Načítavam kontakty s IČO pre hĺbkové obohatenie...");
        
        const leads = await sql`
            SELECT id, website, ico 
            FROM leads 
            WHERE ico IS NOT NULL AND ico != ''
        `;

        console.log(`🚀 Našlo sa ${leads.length} kontaktov. Začínam scrapovať ORSR...`);

        for (const lead of leads) {
            console.log(`\n👉 Spracovávam ${lead.website} (IČO: ${lead.ico})...`);
            
            try {
                const orsrData = await orsrGetByIco(lead.ico);
                
                if (orsrData) {
                    console.log(`✅ Získané: ${orsrData.companyName}`);
                    
                    await sql`
                        UPDATE leads 
                        SET 
                            official_company_name = ${orsrData.companyName},
                            address = ${orsrData.address},
                            stakeholders = ${JSON.stringify({
                                executives: orsrData.executives,
                                partners: orsrData.partners,
                                url: orsrData.url
                            })},
                            updated_at = now()
                        WHERE id = ${lead.id}
                    `;
                    console.log(`💾 Databáza aktualizovaná.`);
                } else {
                    console.log(`⚠️ ORSR: IČO nebolo nájdené.`);
                }
            } catch (error: any) {
                console.error(`❌ Chyba pri ${lead.website}:`, error.message);
            }

            // Malá pauza medzi scrapovaním
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("\n✅ Hĺbkové obohatenie dokončené.");
    } catch (error) {
        console.error("❌ Kritická chyba:", error);
    } finally {
        await sql.end();
    }
}

deepEnrich();
