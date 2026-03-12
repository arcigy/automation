import { sql } from "../core/db";

async function run() {
    try {
        console.log("Checking and adding missing columns to 'leads' table...");
        await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_tag TEXT`;
        await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS decision_maker_last_name TEXT`;
        await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_name_short TEXT`;
        await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS icebreaker_sentence TEXT`;
        console.log("Migration successful!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await sql.end();
    }
}
run();
