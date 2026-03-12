import { orsrGetByIco } from "../tools/scraping/orsr-scraper.tool";

async function verifyOurCompany() {
    const ico = "57503028";
    console.log(`🚀 Testujem produkčný scraper pre Arcigy (IČO: ${ico})...`);
    
    const data = await orsrGetByIco(ico);
    
    if (data) {
        console.log("-----------------------------------------");
        console.log(`✅ FIRMA NÁJDENÁ: ${data.companyName}`);
        console.log(`📍 ADRESA: ${data.address}`);
        console.log(`👤 KONATELIA: ${data.executives.join(", ")}`);
        console.log(`👥 SPOLOČNÍCI: ${data.partners.join(", ")}`);
        console.log(`🔗 URL VÝPISU: ${data.url}`);
        console.log("-----------------------------------------");
    } else {
        console.log("❌ Chyba: Firmu sa nepodarilo nájsť alebo scraper zlyhal.");
    }
}

verifyOurCompany();
