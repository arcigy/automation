import { sql } from "../core/db";

async function sample() {
    try {
        const res = await sql`
            SELECT original_name, website, decision_maker_last_name, icebreaker_sentence, verification_status 
            FROM leads 
            WHERE campaign_tag LIKE 'autoservisy_sk_PROD_%' 
            ORDER BY created_at DESC 
            LIMIT 5
        `;
        console.log("Latest enriched leads:");
        res.forEach(l => {
            console.log(`- ${l.original_name} (${l.website})`);
            console.log(`  Priezvisko variable: '${l.decision_maker_last_name}'`);
            console.log(`  Icebreaker: ${l.icebreaker_sentence?.substring(0, 100)}...`);
            console.log(`  Status: ${l.verification_status}`);
            console.log("-------------------");
        });
    } catch (e) {
        console.error("Sample failed:", e);
    } finally {
        await sql.end();
    }
}
sample();
