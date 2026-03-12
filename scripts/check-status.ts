import { sql } from "../core/db";

async function status() {
    try {
        const [total] = await sql`SELECT count(*) FROM leads`;
        const [enriched] = await sql`SELECT count(*) FROM leads WHERE address IS NOT NULL`;
        const recent = await sql`SELECT website, official_company_name, stakeholders FROM leads WHERE address IS NOT NULL ORDER BY updated_at DESC LIMIT 5`;

        console.log(`📊 CELKOVÝ STAV:`);
        console.log(`Spracované (obohatené): ${enriched.count} / ${total.count}`);
        console.log(`\n🔍 POSLEDNÝCH 5 OBOHATENÝCH:`);
        recent.forEach((r: any) => {
            const sh = r.stakeholders as any;
            console.log(`- ${r.website}`);
            console.log(`  🏢 ${r.official_company_name}`);
            console.log(`  👤 ${sh.executives?.join(", ") || "N/A"}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

status();
