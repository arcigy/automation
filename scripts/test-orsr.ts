import { webScraperTool } from "../tools/scraping/web-scraper.tool";

async function testOrsr() {
    const ico = "36181165"; // Náhodné IČO pre test
    const url = `https://www.orsr.sk/vyhladavanie.asp?lan=0&res=S&sco=ico&ico=${ico}`;
    
    console.log(`Checking ORSR for IČO: ${ico}...`);
    try {
        const results = await webScraperTool({ url, depth: 0 });
        console.log("Results sample:", results[0].text.substring(0, 500));
        
        // Hľadáme link na výpis
        const match = results[0].text.match(/vypis\.asp\?ID=[^&"]+/);
        if (match) {
            console.log("Found detail link:", match[0]);
            const detailUrl = `https://www.orsr.sk/${match[0]}`;
            const detailResults = await webScraperTool({ url: detailUrl, depth: 0 });
            console.log("Detail sample:", detailResults[0].text.substring(0, 1000));
        } else {
            console.log("No detail link found.");
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

testOrsr();
