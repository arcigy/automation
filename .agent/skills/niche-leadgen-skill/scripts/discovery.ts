#!/usr/bin/env bun
/**
 * scripts/discovery.ts
 * Lead Discovery — scraping firiem z Google Maps a/alebo Serper.
 *
 * Použitie:
 *   bun scripts/discovery.ts --niche "stavebniny" --region "Bratislava"
 *   bun scripts/discovery.ts --niche "realitky" --source serper --target 50
 *   bun scripts/discovery.ts --niche "autoservisy" --region all-slovakia --resume
 *   bun scripts/discovery.ts --niche "test" --region "Košice" --dry-run --verbose
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Arg Parsing ─────────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    niche:    { type: "string" },
    region:   { type: "string", default: "Bratislava" },
    source:   { type: "string", default: "both" },    // maps | serper | both
    target:   { type: "string", default: "100" },
    "dry-run":{ type: "boolean", default: false },
    verbose:  { type: "boolean", default: false },
    quiet:    { type: "boolean", default: false },
    resume:   { type: "boolean", default: false },
    force:    { type: "boolean", default: false },
  },
  strict: false,
});

if (!args.niche) {
  console.error("❌ Chýba --niche parameter. Príklad: --niche stavebniny");
  process.exit(1);
}

const SKILL_ROOT = join(import.meta.dir, "..");
const PROJECT_ROOT = join(SKILL_ROOT, "..", "..", "..");

// ─── Logging ─────────────────────────────────────────────────────────────────
type LogLevel = "info" | "warn" | "err" | "ok" | "skip" | "data";
function log(level: LogLevel, msg: string) {
  if (args.quiet && level !== "err" && level !== "data") return;
  const icons: Record<LogLevel, string> = {
    info: "🔍", warn: "⚠️ ", err: "❌", ok: "✅", skip: "⏭️ ", data: "📊"
  };
  console.log(`${icons[level]} ${msg}`);
}
function verbose(msg: string) {
  if (args.verbose && !args.quiet) console.log(`   ${msg}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

const GLOBAL_BLACKLIST = new Set([
  "zivefirmy.sk", "firmy.sk", "zlatestranky.sk", "facebook.com",
  "instagram.com", "linkedin.com", "twitter.com", "youtube.com",
  "google.com", "profesia.sk", "topky.sk", "sme.sk", "pravda.sk",
  "wikipedia.org", "gov.sk", "slovensko.sk",
]);

// ─── Load niche template ──────────────────────────────────────────────────────
function loadNicheTemplate(niche: string): { maps_queries: string[]; serper_queries: string[]; blacklist_keywords: string[] } | null {
  try {
    const tmplPath = join(SKILL_ROOT, "references", "niche-templates.md");
    const content = readFileSync(tmplPath, "utf-8");
    const slug = niche.toLowerCase().replace(/\s+/g, "-");

    // Parse YAML blocks in markdown
    const nicheBlockRegex = new RegExp(
      `niche:\\s*${slug}[\\s\\S]*?(?=\\nniche:|$)`, "i"
    );
    const block = content.match(nicheBlockRegex)?.[0];
    if (!block) return null;

    const extract = (key: string): string[] => {
      const m = block.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
      if (!m) return [];
      return m[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
    };

    return {
      maps_queries: extract("maps_queries"),
      serper_queries: extract("serper_queries"),
      blacklist_keywords: extract("blacklist_keywords"),
    };
  } catch { return null; }
}

// ─── Regions ─────────────────────────────────────────────────────────────────
function loadAllSlovakiaRegions(): string[] {
  try {
    const path = join(SKILL_ROOT, "references", "regions-slovakia.md");
    const content = readFileSync(path, "utf-8");
    return content.split("\n")
      .map(l => l.trim())
      .filter(l => l.startsWith("- "))
      .map(l => l.slice(2).trim())
      .filter(Boolean);
  } catch {
    // Fallback na krajské mestá
    return ["Bratislava", "Trnava", "Trenčín", "Nitra", "Žilina", "Banská Bystrica", "Prešov", "Košice"];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);

  const niche = args.niche!;
  const source = (args.source as string).toLowerCase();
  const targetCount = parseInt(args.target as string, 10);
  const isDryRun = args["dry-run"] as boolean;
  const isResume = args.resume as boolean;
  const isForce = args.force as boolean;

  // Determine regions to scrape
  let regions: string[] = [];
  if ((args.region as string).toLowerCase() === "all-slovakia") {
    regions = loadAllSlovakiaRegions();
    log("info", `Region: celé Slovensko (${regions.length} miest)`);
  } else {
    regions = [(args.region as string)];
  }

  const template = loadNicheTemplate(niche);
  if (!template) {
    log("warn", `Šablóna pre niche "${niche}" nenájdená v niche-templates.md. Používam generické keywords.`);
  }

  // Decide which maps keywords to use
  const mapsQueries = template?.maps_queries.length
    ? template.maps_queries.map(q => q)
    : [niche];
  const serperQueries = template?.serper_queries.length
    ? template.serper_queries
    : [`"${niche}" kontakt email`];
  const nicheBlacklist = new Set(template?.blacklist_keywords ?? []);

  // Load existing domains from DB (dedup)
  const existingRows = await sql<{ website: string }[]>`SELECT website FROM leads`;
  const existingDomains = new Set<string>(
    existingRows.map(r => normalizeDomain(r.website)).filter(Boolean) as string[]
  );
  log("info", `Existujúcich domén v DB: ${existingDomains.size}`);

  // Load DB blacklist
  let dbBlacklist = new Set<string>();
  try {
    await sql`CREATE TABLE IF NOT EXISTS domain_blacklist (domain TEXT PRIMARY KEY, added_at TIMESTAMPTZ DEFAULT now(), reason TEXT)`;
    const rows = await sql<{ domain: string }[]>`SELECT domain FROM domain_blacklist`;
    dbBlacklist = new Set(rows.map(r => r.domain));
    verbose(`DB blacklist: ${dbBlacklist.size} domén`);
  } catch (e) { verbose(`DB blacklist načítanie zlyhalo: ${e}`); }

  // Resume logic
  let resumeFrom = 0;
  if (isResume) {
    try {
      await sql`CREATE TABLE IF NOT EXISTS resume_state (key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ DEFAULT now())`;
      const rows = await sql<{ value: { region_index?: number } }[]>`SELECT value FROM resume_state WHERE key = ${`discovery_${niche}`}`;
      if (rows.length > 0 && rows[0].value?.region_index !== undefined) {
        resumeFrom = rows[0].value.region_index;
        log("info", `▶️  Resume od regiónu #${resumeFrom + 1}: ${regions[resumeFrom]}`);
      }
    } catch (e) { verbose(`Resume state načítanie zlyhalo: ${e}`); }
  }

  // 7-day guard
  if (!isForce && !isDryRun) {
    try {
      await sql`CREATE TABLE IF NOT EXISTS niche_regions (niche TEXT, region TEXT, last_scraped_at TIMESTAMPTZ, PRIMARY KEY (niche, region))`;
    } catch (e) { verbose(`niche_regions init: ${e}`); }
  }

  // ─── TOTALS ──────────────────────────────────────────────────────────────
  let totalDiscovered = 0;
  let totalDuplicates = 0;
  let totalBlacklisted = 0;
  const allNewLeads: Array<{ name: string; website: string; phone?: string; source: string; niche_slug: string; region: string }> = [];

  // ─── PER REGION LOOP ─────────────────────────────────────────────────────
  for (let regionIdx = resumeFrom; regionIdx < regions.length; regionIdx++) {
    const region = regions[regionIdx];

    if (!isForce && !isDryRun) {
      try {
        const rows = await sql<{ last_scraped_at: Date }[]>`
          SELECT last_scraped_at FROM niche_regions WHERE niche = ${niche} AND region = ${region}
        `;
        if (rows.length > 0) {
          const daysSince = (Date.now() - rows[0].last_scraped_at.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) {
            log("skip", `${region} — scraped pred ${daysSince.toFixed(1)} dňami (< 7). Preskakujem. (--force na override)`);
            continue;
          }
        }
      } catch (e) { verbose(`7-day guard check zlyhalo: ${e}`); }
    }

    if (regions.length > 1 && !args.quiet) {
      console.log(`\n${"─".repeat(50)}`);
      log("info", `[${regionIdx + 1}/${regions.length}] Región: ${region}`);
    } else {
      log("info", `Región: ${region} | Niche: ${niche} | Source: ${source} | Target: ${targetCount} | DryRun: ${isDryRun}`);
    }

    const regionDiscovered: typeof allNewLeads = [];
    const seenInRun = new Set<string>();
    let regionDups = 0;
    let regionBlacklisted = 0;

    function isBlocked(domain: string, name?: string): "blacklist_db" | "blacklist_niche" | "existing" | "seen" | false {
      if (GLOBAL_BLACKLIST.has(domain) || dbBlacklist.has(domain)) return "blacklist_db";
      if (name && [...nicheBlacklist].some(kw => name.toLowerCase().includes(kw.toLowerCase()))) return "blacklist_niche";
      if (existingDomains.has(domain)) return "existing";
      if (seenInRun.has(domain)) return "seen";
      return false;
    }

    // ── Google Maps ────────────────────────────────────────────────────────
    if (source === "maps" || source === "both") {
      log("info", `📡 [MAPS] ${mapsQueries.length} queries pre ${region}...`);
      for (const keyword of mapsQueries) {
        if (regionDiscovered.length >= targetCount) break;
        const query = `${keyword} ${region}`;
        verbose(`Maps query: "${query}"`);

        try {
          // Volanie Google Maps Places Text Search
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${cfg.GOOGLE_MAPS_API_KEY}&language=sk`;
          const res = await fetch(url);
          const data = await res.json() as { results?: Array<{ name: string; formatted_address?: string; website?: string; formatted_phone_number?: string }> };
          const places = data.results ?? [];

          let newFromQuery = 0;
          for (const place of places) {
            if (!place.website) continue;
            const domain = normalizeDomain(place.website);
            if (!domain) continue;

            const blocked = isBlocked(domain, place.name);
            if (blocked) {
              if (blocked === "existing" || blocked === "seen") regionDups++;
              else regionBlacklisted++;
              verbose(`  ⏭️  ${domain} (${blocked})`);
              continue;
            }

            seenInRun.add(domain);
            existingDomains.add(domain);
            regionDiscovered.push({ name: place.name, website: place.website.startsWith("http") ? place.website : `https://${place.website}`, source: "google_maps", niche_slug: niche, region });
            newFromQuery++;
            verbose(`  ✅ ${place.name} → ${domain}`);
          }
          log("ok", `[MAPS] "${keyword}": ${newFromQuery} nových`);
          await new Promise(r => setTimeout(r, 800));
        } catch (e: any) {
          log("warn", `[MAPS] "${query}" zlyhalo: ${e.message}`);
        }
      }
    }

    // ── Serper ────────────────────────────────────────────────────────────
    if ((source === "serper" || source === "both") && regionDiscovered.length < targetCount) {
      log("info", `📡 [SERPER] ${serperQueries.length} queries pre ${region}...`);
      for (const queryTpl of serperQueries) {
        if (regionDiscovered.length >= targetCount) break;
        const query = `${queryTpl} ${region}`;
        verbose(`Serper query: "${query}"`);

        try {
          const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": cfg.SERPER_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ q: query, num: 10, gl: "sk", hl: "sk" }),
          });
          const data = await res.json() as { organic?: Array<{ title: string; link: string }> };
          const results = data.organic ?? [];

          let newFromQuery = 0;
          for (const r of results) {
            if (!r.link) continue;
            const domain = normalizeDomain(r.link);
            if (!domain) continue;

            const blocked = isBlocked(domain, r.title);
            if (blocked) {
              if (blocked === "existing" || blocked === "seen") regionDups++;
              else regionBlacklisted++;
              verbose(`  ⏭️  ${domain} (${blocked})`);
              continue;
            }

            seenInRun.add(domain);
            existingDomains.add(domain);
            regionDiscovered.push({ name: r.title.split("|")[0].split("–")[0].trim(), website: r.link.startsWith("http") ? r.link : `https://${r.link}`, source: "serper", niche_slug: niche, region });
            newFromQuery++;
            verbose(`  ✅ ${domain}`);
          }
          log("ok", `[SERPER] "${queryTpl}": ${newFromQuery} nových`);
          await new Promise(r => setTimeout(r, 500));
        } catch (e: any) {
          log("warn", `[SERPER] "${query}" zlyhalo: ${e.message}`);
        }
      }
    }

    // ── Save to DB ────────────────────────────────────────────────────────
    const finalRegionLeads = regionDiscovered.slice(0, targetCount);
    log("data", `[${region}] ${finalRegionLeads.length} nových | ${regionDups} duplikátov | ${regionBlacklisted} blacklist`);

    if (!isDryRun && finalRegionLeads.length > 0) {
      for (const lead of finalRegionLeads) {
        try {
          await sql`
            INSERT INTO leads (website, original_name, source, campaign_tag)
            VALUES (${lead.website}, ${lead.name}, ${lead.source}, ${lead.niche_slug})
            ON CONFLICT (website) DO NOTHING
          `;
        } catch (e: any) { verbose(`DB insert error: ${e.message}`); }
      }
      // Update 7-day guard
      await sql`
        INSERT INTO niche_regions (niche, region, last_scraped_at)
        VALUES (${niche}, ${region}, now())
        ON CONFLICT (niche, region) DO UPDATE SET last_scraped_at = now()
      `;
      log("ok", `[DB] Uložených: ${finalRegionLeads.length} leadov`);
    } else if (isDryRun) {
      log("info", `[DRY-RUN] Nič neuložené. Prvé 3: ${finalRegionLeads.slice(0, 3).map(l => l.name).join(", ")}`);
    }

    // Save resume state
    if (isResume && !isDryRun) {
      try {
        await sql`
          INSERT INTO resume_state (key, value, updated_at)
          VALUES (${`discovery_${niche}`}, ${JSON.stringify({ region_index: regionIdx + 1 })}, now())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `;
      } catch (e) { verbose(`Resume state save zlyhalo: ${e}`); }
    }

    totalDiscovered += finalRegionLeads.length;
    totalDuplicates += regionDups;
    totalBlacklisted += regionBlacklisted;
    allNewLeads.push(...finalRegionLeads);
  }

  // ─── Final summary ──────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  log("data", `DISCOVERY HOTOVO`);
  log("data", `  Nových leadov :  ${totalDiscovered}`);
  log("data", `  Duplikáty     :  ${totalDuplicates}`);
  log("data", `  Blacklist     :  ${totalBlacklisted}`);
  log("data", `  DryRun        :  ${isDryRun ? "ÁNO (nič neuložené)" : "NIE (uložené do DB)"}`);
  console.log(`${"═".repeat(50)}\n`);

  // Clear resume state on successful completion
  if (isResume && !isDryRun && totalDiscovered >= 0) {
    try {
      await sql`DELETE FROM resume_state WHERE key = ${`discovery_${niche}`}`;
      verbose("Resume state vymazaný (dokončené).");
    } catch (e) { /* ignore */ }
  }

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
