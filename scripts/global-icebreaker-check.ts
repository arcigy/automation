import { sql } from "../core/db";

async function globalIcebreakerTargets() {
  const stats = await sql`
    SELECT 
      COUNT(*) as missing_icebreaker
    FROM leads 
    WHERE primary_email IS NOT NULL 
    AND primary_email != ''
    AND (icebreaker_sentence IS NULL OR icebreaker_sentence = '')
  `;

  console.log("Global target leads for icebreaker generation:");
  console.log(JSON.stringify(stats[0], null, 2));
  process.exit(0);
}

globalIcebreakerTargets();
