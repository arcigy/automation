import { sql } from "../core/db";
import { webScraperTool } from "../tools/scraping/web-scraper.tool";
import { orsrGetByIco } from "../tools/scraping/orsr-scraper.tool";
import { syncLeadsToGoogleSheets } from "./sync-to-google-sheets";
import { serperSearchTool } from "../tools/google/serper-search.tool";

/**
 * Agresívny regex pre slovenské IČO. 
 * Hľadá labels (IČO, ICO) aj čisté 8-miestne čísla s medzerami/bodkami.
 */
function extractIco(text: string): string | null {
    if (!text) return null;
    
    // 1. Skúsime nájsť s labelom (najpresnejšie)
    const labelMatch = text.match(/(?:I[ČC]O|Identifikačné číslo)\s*[:.-]?\s*([0-9\s.]{8,11})/i);
    if (labelMatch) {
        const clean = labelMatch[1].replace(/[\s.]/g, "");
        if (clean.length === 8) return clean;
    }

    // 2. Skúsime hľadať akékoľvek 8-miestne číslo, ktoré vyzerá ako IČO
    const allMatches = text.matchAll(/\b([0-9\s.]{8,11})\b/g);
    for (const match of allMatches) {
        const clean = match[1].replace(/[\s.]/g, "");
        if (clean.length === 8 && /^[1-7]/.test(clean)) {
            return clean;
        }
    }
    
    return null;
}



async function analyzeAll() {
    try {
        console.log("🚀 Štartujem hromadnú analýzu všetkých webov...");
        
        const leads = await sql`
            SELECT id, website, ico, official_company_name, decision_maker_name 
            FROM leads 
            WHERE address IS NULL OR address = ''
            ORDER BY created_at DESC
        `;

        console.log(`📋 Našlo sa ${leads.length} nových leadov na obohatenie.\n`);


        for (const lead of leads) {
            let ico = lead.ico;
            let website = lead.website;

            console.log(`--------------------------------------------------`);
            console.log(`🌐 WEB: ${website}`);

            // 1. Ak nemáme IČO, skúsime ho nájsť na webe
            if (!ico || ico.length < 5) {
                console.log(`🔍 Hľadám IČO na webe...`);
                try {
                    const scrapedData = await webScraperTool({ url: website, depth: 1 });
                    
                    for (const page of scrapedData) {
                        const found = extractIco(page.text);
                        if (found) {
                            ico = found;
                            console.log(`✅ Nájdené IČO na webe: ${ico}`);
                            break;
                        }
                    }
                } catch (e: any) {
                    console.error(`❌ Scraping zlyhal: ${e.message}`);
                }

                // Ak sa na webe nenašlo, hľadáme cez Google (serper)
                if (!ico || ico.length < 5) {
                    console.log(`🔍 IČO na webe nenájdené, hľadám cez Google...`);
                    try {
                        const domain = new URL(website).hostname.replace('www.', '');
                        const searchQuery = `${domain} IČO`;
                        
                        const searchResults = await serperSearchTool({ query: searchQuery });
                        const searchTexts = searchResults.map((r: any) => `${r.title} ${r.snippet} ${r.link}`).join(" ");
                        
                        // Využijeme primárnu extrakciu
                        let found = extractIco(searchTexts);
                        
                        if (!found) {
                            // Špeciálny záložný regex pre google texty
                            const match = searchTexts.match(/(?:I[CČcč][OÓoó][\s\.:\-;]*|\b)(\d{2}[\s]*\d{3}[\s]*\d{3}|\d{8})\b/i);
                            if (match) {
                                const clean = match[1].replace(/[\s.]/g, "");
                                if (clean.length === 8 && /^[345]/.test(clean)) { // 3, 4, 5 pre bežné IČO
                                    found = clean;
                                }
                            }
                        }

                        if (found) {
                            ico = found;
                            console.log(`✅ Nájdené IČO cez Google: ${ico}`);
                        } else {
                            console.log(`❌ IČO sa nenašlo ani cez Google.`);
                        }
                    } catch (e: any) {
                        console.error(`❌ Google vyhľadávanie zlyhalo: ${e.message}`);
                    }
                }

            } else {
                console.log(`ℹ️ IČO už máme: ${ico}`);
            }


            // 2. Ak máme IČO (pôvodné alebo nové), obohatíme cez ORSR
            if (ico && ico.length >= 8) {
                console.log(`🏛️ Volám ORSR pre IČO ${ico}...`);
                const orsr = await orsrGetByIco(ico);
                
                if (orsr) {
                    console.log(`✨ ORSR ÚSPECH: ${orsr.companyName}`);
                    console.log(`📍 SÍDLO: ${orsr.address}`);
                    console.log(`👤 KONATELIA: ${orsr.executives.join(", ")}`);

                    // Resolve decision maker name
                    let dmName = lead.decision_maker_name;
                    if (!dmName) {
                        const candidates = [...orsr.executives, ...orsr.partners];
                        if (candidates.length > 0) {
                            dmName = candidates[0];
                            console.log(`💡 Meno decision makera nastavené na: ${dmName}`);
                        }
                    }

                    // Uložíme do DB
                    await sql`
                        UPDATE leads 
                        SET 
                            ico = ${ico},
                            official_company_name = ${orsr.companyName},
                            decision_maker_name = ${dmName},
                            address = ${orsr.address},
                            stakeholders = ${JSON.stringify({
                                executives: orsr.executives,
                                partners: orsr.partners,
                                url: orsr.url
                            })},
                            updated_at = now()
                        WHERE id = ${lead.id}
                    `;
                    console.log(`💾 Dáta uložené. Spúšťam synchronizáciu do Sheetu...`);
                    await syncLeadsToGoogleSheets();
                } else {
                    console.log(`⚠️ ORSR dáta nenájdené.`);
                }
            } else {
                console.log(`⏭️ IČO sa nepodarilo získať.`);
            }
            
            // Malá pauza pre slušnosť k serverom
            await new Promise(r => setTimeout(r, 800));
        }

        console.log(`\n✅ Analýza všetkých ${leads.length} webov bola dokončená.`);
        
    } catch (error: any) {
        console.error("❌ Kritická chyba v analýze:", error.message);
        console.error(error.stack);
    } finally {
        console.log("👋 Ukončujem pripojenie k databáze...");
        await sql.end({ timeout: 5 });
        process.exit(0);
    }
}

analyzeAll().catch(err => {
    console.error("🔥 UNHANDLED ERROR:", err);
    process.exit(1);
});


