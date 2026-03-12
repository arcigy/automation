import { sql } from "../core/db";

async function checkSync() {
  console.log("🔍 Kontrolujem synchronizáciu databázy...\n");

  const tables = ['niches', 'leads', 'automation_logs', 'sent_replies'];

  for (const table of tables) {
    console.log(`--- Tabuľka: ${table} ---`);
    try {
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${table}
        ORDER BY ordinal_position
      `;
      
      if (columns.length === 0) {
        console.log(`❌ Tabuľka ${table} nebola nájdená.`);
      } else {
        columns.forEach(col => {
          console.log(`  - ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(15)} | Null: ${col.is_nullable} | Def: ${col.column_default || 'NULL'}`);
        });
      }
    } catch (err: any) {
      console.error(`❌ Chyba pri čítaní ${table}:`, err.message);
    }
    console.log("");
  }

  process.exit(0);
}

checkSync();
