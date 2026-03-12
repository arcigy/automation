import { orsrMasterLookup } from "../tools/scraping/orsr-scraper.tool";

async function test() {
    // Testujeme prípad: IČO nájde firmu ale bez konateľov → fallback na Loop B s ORSR menom
    console.log("══════════════════════════════════════════════");
    console.log("TEST: IČO → prázdni konatelia → Loop B s ORSR názvom");
    console.log("══════════════════════════════════════════════");

    // Použijeme reálne IČO ktoré malo prázdnych konateľov (99999999 - štátny podnik)
    const r = await orsrMasterLookup({
        ico: "99999999",
        companyName: "Poľnohospodárske zásobovanie a nákup"  // AI návrh (menej presný)
    });

    console.log("\nVýsledok:", JSON.stringify(r, null, 2));
    
    console.log("\n══════════════════════════════════════════════");
    console.log("TEST 2: Naša firma Arcigy — má konateľov, Loop B sa nespustí");
    console.log("══════════════════════════════════════════════");
    const r2 = await orsrMasterLookup({ ico: "57503028", companyName: "Arcigy" });
    console.log("Konatelia:", r2?.executives);
    console.log("Source:", r2?.source);
}

test().catch(console.error);
