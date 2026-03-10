import { webScraperTool } from "./tools/scraping/web-scraper.tool";
import * as fs from "fs";

async function run() {
    const payload = JSON.parse(fs.readFileSync("automations/lead-enricher/payload.json", "utf8"));
    const leads = payload.leads;
    console.log(`Starting to scrape ${leads.length} autoservis leads...`);

    const results: any[] = [];
    let successCount = 0;
    let emailsCount = 0;

    for (const lead of leads) {
        if (!lead.website) continue;
        console.log(`Scraping: ${lead.website}`);
        try {
            const data = await webScraperTool({ url: lead.website, depth: 1 });
            const emails = [...new Set(data.flatMap(d => d.emails))];
            
            if (emails.length > 0) {
                console.log(`  -> FOUND EMAILS: ${emails.join(', ')}`);
                emailsCount += emails.length;
            } else {
                console.log(`  -> No emails found.`);
            }

            results.push({ name: lead.name, website: lead.website, emails });
            successCount++;
        } catch(e: any) {
            console.error(`  -> Failed: ${e.message}`);
        }
    }

    console.log(`\nDONE! Scraped ${successCount} websites out of ${leads.length}.`);
    console.log(`Found a total of ${emailsCount} unique emails.`);
    fs.writeFileSync("scraper_test_results.json", JSON.stringify(results, null, 2));
}

run();
