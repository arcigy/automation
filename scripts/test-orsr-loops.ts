import { orsrMasterLookup, isValidIco } from "../tools/scraping/orsr-scraper.tool";

async function test() {
    console.log("══════════════════════════════════════════════");
    console.log("TEST 1: Lookup podľa IČO (Arcigy)");
    console.log("══════════════════════════════════════════════");
    const r1 = await orsrMasterLookup({ ico: "57503028" });
    console.log("Výsledok:", JSON.stringify(r1, null, 2));

    console.log("\n══════════════════════════════════════════════");
    console.log("TEST 2: Lookup podľa nesprávneho IČO (fallback na meno)");
    console.log("══════════════════════════════════════════════");
    const r2 = await orsrMasterLookup({ ico: "99999999", companyName: "Arcigy s.r.o." });
    console.log("Výsledok:", JSON.stringify(r2, null, 2));

    console.log("\n══════════════════════════════════════════════");
    console.log("TEST 3: Lookup iba podľa mena (bez IČO)");
    console.log("══════════════════════════════════════════════");
    const r3 = await orsrMasterLookup({ ico: null, companyName: "Slovenská sporiteľňa a. s." });
    console.log("Výsledok:", JSON.stringify(r3, null, 2));

    console.log("\n══════════════════════════════════════════════");
    console.log("TEST 4: isValidIco validácia");
    console.log("══════════════════════════════════════════════");
    const icos = ["57503028", "1234567", "99abc", "12345678", "1234", "0012345678"];
    for (const ico of icos) {
        console.log(`  "${ico}" → ${isValidIco(ico) ? "✅ PLATNÉ" : "❌ NEPLATNÉ"}`);
    }
}

test().catch(console.error);
