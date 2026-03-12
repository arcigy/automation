import { sql } from "../core/db";

async function run() {
    try {
        const total = await sql`SELECT count(*) as count FROM leads`;
        const verified = await sql`SELECT count(*) as count FROM leads WHERE verification_status = 'verified'`;
        const statusBreakdown = await sql`SELECT verification_status, count(*) as count FROM leads GROUP BY verification_status`;
        
        console.log(`TOTAL LEADS IN DB: ${total[0].count}`);
        console.log(`VERIFIED LEADS: ${verified[0].count}`);
        console.log("STATUS BREAKDOWN:");
        statusBreakdown.forEach(s => console.log(` - ${s.verification_status}: ${s.count}`));
    } finally {
        await sql.end();
    }
}
run();
