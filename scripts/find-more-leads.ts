import { sql } from "../core/db";
import { handler as discoveryHandler } from "../automations/lead-discovery/handler";

async function findMore() {
  const niche = await sql`SELECT slug, keywords FROM niches WHERE name = 'Auto Servis'`;
  if (niche.length === 0) return;

  const slug = niche[0].slug;
  const keywords = niche[0].keywords;
  
  console.log(`🚀 Spúšťam discovery pre ${slug} v Banská Bystrica...`);
  
  await discoveryHandler({
    niche_slug: slug,
    keywords: keywords,
    region: "Banská Bystrica",
    target_count: 50
  });

  console.log("✅ Discovery dokončená.");
  process.exit(0);
}

findMore().catch(console.error);
