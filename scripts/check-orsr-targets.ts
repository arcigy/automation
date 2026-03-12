import { sql } from "../core/db";

async function checkOrsrTargets() {
  const targets = await sql`
    SELECT COUNT(*) as count
    FROM leads 
    WHERE ico IS NOT NULL AND ico != ''
    AND (decision_maker_name IS NULL OR decision_maker_name = '')
  `;
  console.log(`Leads with ICO but missing name: ${targets[0].count}`);
  process.exit(0);
}

checkOrsrTargets();
