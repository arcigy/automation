import { sql } from "../../core/db";

export interface ActiveNiche {
  id: string;
  slug: string;
  name: string;
  keywords: string[];
  activeRegion: string;
  daily_target: number;
  smartlead_campaign_id: string | null;
}

/** Returns the active niche + advances its region index for next run */
export async function getActiveNiche(): Promise<ActiveNiche | null> {
  // "Sticky" logic: Pick the niche we worked on last time to "squeeze" it fully
  const niches = await sql`
    SELECT n.id, n.slug, n.name, n.keywords, n.regions, n.current_region_index,
           n.daily_target, n.smartlead_campaign_id,
           COALESCE(ns.sent_to_smartlead, 0) as today_sent
    FROM niches n
    LEFT JOIN niche_stats ns ON ns.niche_id = n.id AND ns.date = CURRENT_DATE
    WHERE n.status = 'active'
    ORDER BY n.last_worked_at DESC NULLS LAST, n.tier ASC, n.created_at ASC
    LIMIT 1
  `;

  if (!niches.length) return null;

  const niche = niches[0];
  const regions: string[] = niche.regions;
  const regionIndex: number = niche.current_region_index % regions.length;
  const activeRegion = regions[regionIndex];

  // Advance region index for next run
  await sql`
    UPDATE niches
    SET current_region_index = ${regionIndex + 1}
    WHERE id = ${niche.id}
  `;

  console.log(`🎯 Aktívny niche: "${niche.name}" | Región: "${activeRegion}" | Odoslané dnes: ${niche.today_sent}`);

  return {
    id: niche.id,
    slug: niche.slug,
    name: niche.name,
    keywords: niche.keywords,
    activeRegion,
    daily_target: niche.daily_target,
    smartlead_campaign_id: niche.smartlead_campaign_id,
  };
}

/** Ensure niche_stats row exists for today, update counts */
export async function logNicheStats(
  niche_id: string,
  updates: {
    discovered?: number;
    enriched?: number;
    qualified?: number;
    sent_to_smartlead?: number;
    failed?: number;
  }
) {
  await sql`
    INSERT INTO niche_stats (niche_id, date, discovered, enriched, qualified, sent_to_smartlead, failed)
    VALUES (${niche_id}, CURRENT_DATE,
      ${updates.discovered || 0}, ${updates.enriched || 0},
      ${updates.qualified || 0}, ${updates.sent_to_smartlead || 0}, ${updates.failed || 0})
    ON CONFLICT (niche_id, date) DO UPDATE SET
      discovered   = niche_stats.discovered   + EXCLUDED.discovered,
      enriched     = niche_stats.enriched     + EXCLUDED.enriched,
      qualified    = niche_stats.qualified    + EXCLUDED.qualified,
      sent_to_smartlead = niche_stats.sent_to_smartlead + EXCLUDED.sent_to_smartlead,
      failed       = niche_stats.failed       + EXCLUDED.failed
  `;
}
