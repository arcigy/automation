import { sql } from "../core/db";

async function samples() {
    try {
        const res = await sql`
            SELECT original_name, website, decision_maker_last_name, icebreaker_sentence 
            FROM leads 
            WHERE verification_status = 'verified' 
            ORDER BY created_at DESC 
            LIMIT 5
        `;
        console.log("SUCCESSFUL EXAMPLES:");
        res.forEach(l => {
            console.log(`- ${l.original_name} (${l.website})`);
            console.log(`  Oslovenie: Dobrý deň${l.decision_maker_last_name},`);
            console.log(`  Pochvala: ${l.icebreaker_sentence}`);
            console.log("-------------------");
        });
    } finally {
        await sql.end();
    }
}
samples();
