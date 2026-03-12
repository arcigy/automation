import { orsrGetByIco } from "../tools/scraping/orsr-scraper.tool";

async function test(ico: string) {
    console.log(`🚀 Testing ORSR for IČO: ${ico}`);
    const res = await orsrGetByIco(ico);
    console.log(JSON.stringify(res, null, 2));
}

const ico = process.argv[2] || "44665327"; // VASAK s.r.o.
test(ico);
