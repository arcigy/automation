import { getActiveNiche } from "../automations/niche-manager/handler";
import { handler as discoveryHandler } from "../automations/lead-discovery/handler";

async function testDiscovery() {
  console.log("🧪 TEST: Niche Manager + Lead Discovery\n");

  const niche = await getActiveNiche();
  if (!niche) {
    console.error("❌ Žiadny aktívny niche!");
    return;
  }

  console.log(`🎯 Vybraný niche: ${niche.name}`);
  console.log(`🌍 Región: ${niche.activeRegion}`);

  const discoveryRes = await discoveryHandler({
    niche_slug: niche.slug,
    keywords: niche.keywords.slice(0, 2), // Len 2 keywords pre rýchly test
    region: niche.activeRegion,
    target_count: 5 // Len 5 leadov pre test
  });

  if (discoveryRes.success && discoveryRes.data) {
    console.log(`\n✅ Nájdených: ${discoveryRes.data.leads.length} leadov`);
    discoveryRes.data.leads.forEach((l, i) => {
      console.log(`${i+1}. ${l.name} - ${l.website} (${l.phone || 'Bez telefónu'})`);
    });
  } else {
    console.error("❌ Discovery zlyhalo:", discoveryRes.error);
  }
}

testDiscovery().catch(console.error).finally(() => process.exit(0));
