import { sql } from "../core/db";

async function migrate() {
    try {
        console.log("🚀 Pridávam rozšírené stĺpce pre ORSR dáta...");
        
        await sql`
            ALTER TABLE leads 
            ADD COLUMN IF NOT EXISTS address TEXT,
            ADD COLUMN IF NOT EXISTS stakeholders JSONB,
            ADD COLUMN IF NOT EXISTS orsr_verified BOOLEAN DEFAULT false;
        `;
        
        console.log("✅ Tabuľka leads bola rozšírená o address a stakeholders.");
    } catch (e) {
        console.error("❌ Chyba pri migrácii:", e);
    } finally {
        await sql.end();
    }
}

migrate();
