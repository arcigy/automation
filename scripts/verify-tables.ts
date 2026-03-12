import { sql } from "../core/db";

async function verify() {
  try {
    await sql`SELECT 1 FROM automation_logs LIMIT 1`;
    console.log("Table automation_logs: EXISTS");
  } catch (e) {
    console.log("Table automation_logs: MISSING");
  }

  try {
    await sql`SELECT 1 FROM niches LIMIT 1`;
    console.log("Table niches: EXISTS");
  } catch (e) {
    console.log("Table niches: MISSING");
  }

  try {
    await sql`SELECT 1 FROM niche_stats LIMIT 1`;
    console.log("Table niche_stats: EXISTS");
  } catch (e) {
    console.log("Table niche_stats: MISSING");
  }

  process.exit(0);
}

verify().catch(console.error);
