import { sql } from "../core/db";

async function check() {
    try {
        const any = await sql`SELECT campaign_tag, count(*) as count FROM leads GROUP BY campaign_tag`;
        console.log("Groups in DB:", any);
        
        const verified = await sql`SELECT campaign_tag, count(*) as count FROM leads WHERE verification_status = 'verified' GROUP BY campaign_tag`;
        console.log("Verified groups:", verified);
    } catch (e) {
        console.error("Check failed:", e);
    } finally {
        await sql.end();
    }
}
check();
