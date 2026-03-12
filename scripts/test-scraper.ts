import { orsrGetByIco } from "../tools/scraping/orsr-scraper.tool";

async function run() {
    const ico = process.argv[2] || "36248325";
    const r = await orsrGetByIco(ico);
    console.log("Result:", r);
}
run();
