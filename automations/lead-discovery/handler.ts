import { inputSchema, type Input, type Output, type DiscoveredLead } from "./schema";
import { logRun } from "../../core/logger";
import { sql } from "../../core/db";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { googleMapsSearchTool } from "../../tools/google/maps-search.tool";
import { serperSearchTool } from "../../tools/google/serper-search.tool";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize domain from any URL → "firma.sk" */
function normalizeDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** BLACKLIST — aggregators, directories, social media we don't want */
const DOMAIN_BLACKLIST = new Set([
  "zivefirmy.sk", "firmy.sk", "zlatestranky.sk", "123kuriér.sk",
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com",
  "youtube.com", "google.com", "maps.google.com", "yelp.com",
  "profesia.sk", "jobs.sk", "topky.sk", "sme.sk", "pravda.sk",
  "wikipedia.org", "gov.sk", "slovensko.sk", "nbs.sk", "statistics.sk"
]);

function isBlacklistedDomain(domain: string): boolean {
  return DOMAIN_BLACKLIST.has(domain) || domain.length < 4;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function handler(rawInput: unknown): Promise<AutomationResult<Output>> {
  const ctx = {
    automationName: "lead-discovery",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  const input = inputSchema.parse(rawInput);
  const { keywords, region, target_count, niche_slug } = input;

  console.log(`\n🔍 LEAD DISCOVERY: Niche="${niche_slug}" Región="${region}" Cieľ=${target_count}`);

  // Načítaj všetky existujúce domény z DB (pre dedup)
  const existingDomens = await sql`SELECT website FROM leads`;
  const existingSet = new Set<string>(
    existingDomens
      .map(r => normalizeDomain(r.website))
      .filter(Boolean) as string[]
  );
  console.log(`📊 Existujúcich domén v DB: ${existingSet.size}`);

  const discovered: DiscoveredLead[] = [];
  const seenDomains = new Set<string>(); // dedup v rámci tohto behu
  let duplicatesSkipped = 0;

  // ── Google Maps per keyword ────────────────────────────────────────────────
  console.log(`\n🗺️ Google Maps hľadanie (${keywords.length} keywords)...`);
  for (const keyword of keywords) {
    if (discovered.length >= target_count) break;

    const query = `${keyword} ${region}`;
    console.log(`  🔎 Maps: "${query}"`);

    try {
      const places = await googleMapsSearchTool({ query, location: region });

      for (const place of places) {
        if (!place.website) continue;

        const domain = normalizeDomain(place.website);
        if (!domain || isBlacklistedDomain(domain)) continue;
        if (seenDomains.has(domain) || existingSet.has(domain)) {
          duplicatesSkipped++;
          continue;
        }

        seenDomains.add(domain);
        discovered.push({
          name: place.name,
          website: place.website.startsWith("http") ? place.website : `https://${place.website}`,
          phone: place.phone,
          source: "google_maps",
          niche_slug,
          region
        });
      }

      // Polite delay
      await new Promise(r => setTimeout(r, 800));
    } catch (e: any) {
      console.warn(`  ⚠️ Maps "${query}" zlyhalo: ${e.message}`);
    }
  }

  console.log(`  → Po Maps: ${discovered.length} leadov`);

  // ── Serper search per keyword (doplnok ak Maps nestačí) ───────────────────
  if (discovered.length < target_count) {
    console.log(`\n🔎 Serper hľadanie (chýba ${target_count - discovered.length} leadov)...`);

    for (const keyword of keywords) {
      if (discovered.length >= target_count) break;

      const query = `"${keyword}" "${region}" kontakt email`;
      console.log(`  🔎 Serper: "${query}"`);

      try {
        const results = await serperSearchTool({ query, limit: 10 });

        for (const r of results) {
          if (!r.link) continue;

          const domain = normalizeDomain(r.link);
          if (!domain || isBlacklistedDomain(domain)) continue;
          if (seenDomains.has(domain) || existingSet.has(domain)) {
            duplicatesSkipped++;
            continue;
          }

          seenDomains.add(domain);
          discovered.push({
            name: r.title.split("|")[0].split("-")[0].trim(),
            website: r.link.startsWith("http") ? r.link : `https://${r.link}`,
            source: "serper",
            niche_slug,
            region
          });
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e: any) {
        console.warn(`  ⚠️ Serper "${query}" zlyhalo: ${e.message}`);
      }
    }

    console.log(`  → Po Serper: ${discovered.length} leadov`);
  }

  const finalLeads = discovered.slice(0, target_count);

  console.log(`\n✅ Discovery hotovo: ${finalLeads.length} unikátnych leadov, ${duplicatesSkipped} duplikátov preskočených`);

  const result: AutomationResult<Output> = {
    success: true,
    data: {
      leads: finalLeads,
      total_found: finalLeads.length,
      duplicates_skipped: duplicatesSkipped
    },
    durationMs: Date.now() - ctx.startTime,
  };

  await logRun(ctx, result, input);
  return result;
}
