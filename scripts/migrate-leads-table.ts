import { sql } from "../core/db";

async function migrate() {
    try {
        console.log("🚀 Pridávam nové stĺpce do tabuľky leads...");
        
        await sql`
            ALTER TABLE leads 
            ADD COLUMN IF NOT EXISTS ico TEXT,
            ADD COLUMN IF NOT EXISTS official_company_name TEXT;
        `;
        
        console.log("✅ Tabuľka leads bola úspešne aktualizovaná.");
    } catch (e) {
        console.error("❌ Chyba pri migrácii:", e);
    } finally {
        await sql.end();
    }
}

migrate();
