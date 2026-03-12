import { sql } from "../core/db";

async function migrate() {
  console.log("🚀 Spúšťam DB migráciu pre Full Auto Lead Gen System...\n");

  // ── 1. Tabuľka niches ──────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS niches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text UNIQUE NOT NULL,
      name text NOT NULL,
      keywords text[] NOT NULL,
      regions text[] NOT NULL DEFAULT ARRAY['Bratislava','Košice','Žilina','Nitra','Prešov','Trnava','Trenčín','Banská Bystrica','Prešov','Martin','Poprad'],
      smartlead_campaign_id text,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
      daily_target int NOT NULL DEFAULT 130,
      current_region_index int NOT NULL DEFAULT 0,
      tier int NOT NULL DEFAULT 1,
      created_at timestamptz DEFAULT now()
    )
  `;
  console.log("✅ Tabuľka 'niches' vytvorená");

  // ── 2. Tabuľka niche_stats ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS niche_stats (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      niche_id uuid REFERENCES niches(id),
      date date NOT NULL DEFAULT CURRENT_DATE,
      discovered int DEFAULT 0,
      enriched int DEFAULT 0,
      qualified int DEFAULT 0,
      sent_to_smartlead int DEFAULT 0,
      failed int DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      UNIQUE(niche_id, date)
    )
  `;
  console.log("✅ Tabuľka 'niche_stats' vytvorená");

  // ── 3. Rozšírenie leads tabuľky ────────────────────────────────────────────
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS niche_id uuid REFERENCES niches(id)`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_to_smartlead boolean DEFAULT false`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS smartlead_contact_id text`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone text`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS manually_reviewed boolean DEFAULT false`;
  console.log("✅ Stĺpce pridané do 'leads'");

  // ── 4. Naplnenie Tier 1 niches ─────────────────────────────────────────────
  const tier1Niches = [
    {
      slug: "real-estate-agency",
      name: "Realitné Kancelárie",
      keywords: ["realitná kancelária franšíza","realitný maklér samostatný","reality developer novostavby","predaj komerčných nehnuteľností","realitná kancelária prenájom bytov"],
      tier: 1
    },
    {
      slug: "property-management",
      name: "Správa Nehnuteľností",
      keywords: ["správa bytových domov firma","správca nehnuteľností spoločnosť","facility management firma","správa nájomných bytov","správa komerčných priestorov"],
      tier: 1
    },
    {
      slug: "mortgage-brokers",
      name: "Hypotekárni Poradcovia",
      keywords: ["hypotekárny poradca","finančný poradca hypotéky","sprostredkovateľ hypoték","nezávislý hypotekárny maklér"],
      tier: 1
    },
    {
      slug: "dermatologia",
      name: "Dermatológia",
      keywords: ["súkromná dermatologická ambulancia","súkromný dermatológ","kožná ambulancia bez čakacej doby","estetická dermatológia klinika"],
      tier: 1
    },
    {
      slug: "gynekologia",
      name: "Gynekológia",
      keywords: ["súkromná gynekologická ambulancia","privátny gynekológ","gynekológ na súkromné platby"],
      tier: 1
    },
    {
      slug: "ortopedia",
      name: "Ortopédia",
      keywords: ["súkromná ortopedická ambulancia","privátny ortopéd","ortopedická klinika bez poisťovne","artroskopia súkromná klinika"],
      tier: 1
    },
    {
      slug: "psychiatria",
      name: "Psychiatria & Psychológia",
      keywords: ["súkromný psychiater","privátna psychiatrická ambulancia","psychológ na súkromné platby","klinický psychológ súkromná prax"],
      tier: 1
    },
    {
      slug: "ocna-klinika",
      name: "Oftalmológia",
      keywords: ["súkromná očná klinika","laserová korekcia zraku klinika","privátny očný lekár","operácia šedého zákalu súkromná klinika"],
      tier: 1
    },
    {
      slug: "plasticka-chirurgia",
      name: "Plastická Chirurgia",
      keywords: ["plastická chirurgia klinika","estetická chirurgia klinika","augmentácia prsníkov klinika","liposukcia klinika","rhinoplastika klinika"],
      tier: 1
    },
    {
      slug: "ivf-reprodukcia",
      name: "Reprodukčná Medicína",
      keywords: ["klinika asistovanej reprodukcie","IVF klinika","centrum reprodukčnej medicíny","oplodnenie in vitro klinika"],
      tier: 1
    },
    {
      slug: "zubna-klinika",
      name: "Dentálne Praxe",
      keywords: ["súkromná zubná ambulancia","zubná klinika implantáty","ortodontická ambulancia","zubná klinika bez poisťovne","estetická stomatológia klinika"],
      tier: 1
    },
    {
      slug: "fyzioterapia",
      name: "Fyzioterapia",
      keywords: ["fyzioterapeutická ambulancia","fyzioterapeut súkromná prax","rehabilitačné centrum súkromné","športová fyzioterapia klinika"],
      tier: 1
    },
    {
      slug: "med-spa",
      name: "Med Spa & Estetika",
      keywords: ["estetická klinika laserové ošetrenia","med spa klinika","botox fillery klinika","laserová epilácia klinika","mezoterapia klinika"],
      tier: 1
    },
    {
      slug: "advokatske-kancelarie",
      name: "Advokátske Kancelárie",
      keywords: ["advokátska kancelária obchodné právo","advokát trestné právo","advokátska kancelária rodinné právo","advokát pracovné právo","advokátska kancelária real estate"],
      tier: 1
    },
    {
      slug: "uctovnicke-firmy",
      name: "Účtovnícke Firmy",
      keywords: ["účtovnícka firma pre malé podniky","externé účtovníctvo","daňový poradca firma","mzdové účtovníctvo externé","vedenie účtovníctva outsourcing"],
      tier: 1
    },
    {
      slug: "financni-poradcovia",
      name: "Finanční Poradcovia",
      keywords: ["finančný poradca nezávislý","investičný poradca","správa portfólia pre firmy","finančné plánovanie pre podnikateľov"],
      tier: 1
    },
    {
      slug: "poistni-makleri",
      name: "Poisťovací Makléri",
      keywords: ["poistný maklér","sprostredkovateľ poistenia","firemné poistenie maklér","životné poistenie poradca"],
      tier: 1
    },
    // TIER 2
    {
      slug: "personalne-agentury",
      name: "Personálne Agentúry",
      keywords: ["personálna agentúra pre IT","recruitment agentúra","headhunting firma","agentúra dočasného zamestnávania"],
      tier: 2
    },
    {
      slug: "marketing-agentury",
      name: "PPC & Marketing Agentúry",
      keywords: ["PPC agentúra Google Ads","digitálna marketingová agentúra","Facebook Ads agentúra","SEO agentúra pre e-shopy","social media agentúra"],
      tier: 2
    },
    {
      slug: "saas-spolocnosti",
      name: "SaaS Spoločnosti",
      keywords: ["SaaS startup Slovensko","software pre reštaurácie","CRM software pre malé firmy","HR software pre firmy","fakturačný software"],
      tier: 2
    },
    // TIER 3
    {
      slug: "auto-servis",
      name: "Auto Servis",
      keywords: ["autoservis nezávislý","pneuservis firma","autoservis pre firemné vozidlá","karosárske práce firma"],
      tier: 3
    },
    {
      slug: "cleaning-services",
      name: "Upratovacie Firmy",
      keywords: ["upratovacia firma pre kancelárie","čistiaca firma pre firmy","upratovanie po stavbe firma","dezinfekcia priestorov firma"],
      tier: 3
    },
    {
      slug: "stavebne-firmy",
      name: "Stavebné Firmy",
      keywords: ["stavebná firma rodinné domy","generálny dodávateľ stavieb","rekonštrukcia bytov firma","stavebná firma komerčné budovy"],
      tier: 4
    },
    // BONUS
    {
      slug: "veterinarne-kliniky",
      name: "Veterinárne Kliniky",
      keywords: ["súkromná veterinárna klinika","veterinárna ambulancia","veterinár malé zvieratá","pohotovostná veterinárna klinika"],
      tier: 4
    },
    {
      slug: "solo-uctovnici",
      name: "Solo Účtovníci",
      keywords: ["účtovníčka živnostníci","daňové priznanie pomoc","účtovník pre freelancerov","mzdová účtovníčka"],
      tier: 4
    }
  ];

  console.log(`\n📦 Vkladám ${tier1Niches.length} niches...`);

  for (const niche of tier1Niches) {
    await sql`
      INSERT INTO niches (slug, name, keywords, tier, status)
      VALUES (${niche.slug}, ${niche.name}, ${sql.array(niche.keywords)}, ${niche.tier}, 'active')
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        keywords = EXCLUDED.keywords,
        tier = EXCLUDED.tier
    `;
    console.log(`  ✅ ${niche.slug} (Tier ${niche.tier})`);
  }

  // Overenie
  const count = await sql`SELECT COUNT(*) as count FROM niches`;
  console.log(`\n✅ Migrácia úspešná! Celkový počet niches: ${count[0].count}`);
  process.exit(0);
}

migrate().catch(err => {
  console.error("💥 Migrácia zlyhala:", err);
  process.exit(1);
});
