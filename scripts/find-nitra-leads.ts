import { sql } from "../core/db";
import { handler as discoveryHandler } from "../automations/lead-discovery/handler";

async function findMore() {
  const niche = await sql`SELECT slug FROM niches WHERE name = 'Auto Servis'`;
  if (niche.length === 0) return;

  const slug = niche[0].slug;
  const keywords = [
    "servis firemných áut Nitra",
    "autoservis vozový park Nitra",
    "zmluvný autoservis pre firmy Nitra",
    "oprava nákladných áut Nitra",
    "pneuservis kamióny Nitra"
  ];
  
  console.log(`🚀 Spúšťam discovery pre Nitru...`);
  
  await discoveryHandler({
    niche_slug: slug,
    keywords: keywords,
    region: "Nitra",
    target_count: 50
  });

  console.log("✅ Discovery Nitra dokončená.");
  process.exit(0);
}

findMore().catch(console.error);
