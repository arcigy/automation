import { sql } from "../../core/db";
import { orsrMasterLookup, isValidIco } from "../../tools/scraping/orsr-scraper.tool";
import { detectSlovakSalutation } from "../../tools/gender/detector";

export async function scrapeLeadDetails(leadId: string): Promise<any> {
    const lead = await sql`
        SELECT id, website, official_company_name, ico FROM leads WHERE id = ${leadId}
    `;

    if (lead.length === 0) throw new Error("Lead not found");
    const l = lead[0];

    console.log(`🔍 Spúšťam rýchly ORSR scrape pre ${l.website}...`);

    const orsrData = await orsrMasterLookup({
        ico: l.ico,
        companyName: l.official_company_name
    });

    if (!orsrData) return null;

    let finalDecisionMaker = orsrData.executives[0] || orsrData.partners[0] || null;
    let lastNameFormatted = "";

    if (finalDecisionMaker) {
        const nameParts = finalDecisionMaker.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts[nameParts.length - 1] || "";
        const salutation = detectSlovakSalutation(firstName, lastName);
        lastNameFormatted = ` ${salutation} ${lastName}`;
    }

    const updates = {
        official_company_name: orsrData.companyName,
        address: orsrData.address,
        ico: orsrData.ico,
        decision_maker_name: finalDecisionMaker,
        decision_maker_last_name: lastNameFormatted,
        orsr_verified: true,
        updated_at: new Date()
    };

    const result = await sql`
        UPDATE leads 
        SET ${sql(updates)}
        WHERE id = ${leadId}
        RETURNING *
    `;

    return result[0];
}
