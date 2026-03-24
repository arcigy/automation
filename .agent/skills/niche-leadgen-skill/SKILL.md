---
name: niche-leadgen-skill
description: Kompletný lead generation workflow — od scraping niche firiem (Google Maps + Serper) cez AI enrichment (email, decision maker, icebreaker) až po vytvorenie Smartlead kampane a upload leadov.
---

# Niche Lead Gen Skill — Inštrukcie pre Claude

## Stack & Produkcia

- **Runtime**: Bun
- **DB**: PostgreSQL (cez `postgres.js` knižnica, `sql` tag)
- **Produkčná URL**: `https://automation-arcigy.up.railway.app`
- **Skill root**: `C:\Users\laube\Downloads\AUTOMATIZACIE\.agent\skills\niche-leadgen-skill\`
- **Project root**: `C:\Users\laube\Downloads\AUTOMATIZACIE\`

## ENV Premenné (NUTNÉ pred každým spustením)

```
DATABASE_URL            PostgreSQL connection string
SMARTLEAD_API_KEY       Smartlead API kľúč
GOOGLE_MAPS_API_KEY     Google Maps API kľúč
SERPER_API_KEY          Serper.dev API kľúč
```

> ⚡ **ANTHROPIC_API_KEY nie je potrebný.** Icebreakery a email sekvencie generuješ **ty (Claude)** priamo — pozri sekciu "Generovanie AI obsahu" nižšie.

Ak niečo chýba → `config.ts` okamžite zastaví s jasnou chybou. Skontroluj `.env` v project roote.


---

## Rozhodovací strom — ako interpretovať príkazy

### 1. Discovery (Scraping)

| User hovorí | Čo spustiť |
|---|---|
| "Scrapni [niche] v [city]" | `discovery.ts --niche [niche] --region [city]` |
| "Scrapni iba zo Serpera" | pridaj `--source serper` |
| "Scrapni iba z Google Maps" | pridaj `--source maps` |
| "Scrapni celé Slovensko" | pridaj `--region all-slovakia --resume` |
| "X leadov" alebo "cieľ X" | pridaj `--target X` |
| "Bez ukladania" / testovanie | pridaj `--dry-run` |
| "Tichý výstup" | pridaj `--quiet` |

**VŽDY**: Pre kľúčové slová konkrétnej niche čítaj `references/niche-templates.md`.

### 2. Enrichment

| User hovorí | Čo spustiť |
|---|---|
| "Enrichni leady" | `enrich.ts --all-pending` |
| "Enrichni N leadov" | `enrich.ts --limit N` |
| "Enrichni leady z niche X" | `enrich.ts --niche X` |

### 3. Validácia & Scoring

Vždy spusti pred inject-om (pokiaľ user explicitne nechce preskočiť):
```bash
bun scripts/validate.ts --niche [niche]
```

### 4. Inject do Smartleadu

| User hovorí | Čo spustiť |
|---|---|
| "Inject do Smartleadu" | `inject.ts --niche X` |
| "Iba quality leady" | pridaj `--min-score 70` |
| "Vytvor novú kampaň" | pridaj `--create-campaign --use-ai-sequences` |
| "Do existujúcej kampane ID" | pridaj `--campaign-id [ID]` |
| "Skontroluj čo by sa stalo" | pridaj `--dry-run` |

### 5. Celý pipeline naraz

```bash
bun scripts/full-pipeline.ts --niche [niche] --region [city]
```

### 6. Správa & štatistiky

```bash
bun scripts/db-status.ts                    # Prehľad DB
bun scripts/export.ts --niche X --output X.csv   # CSV export
bun scripts/blacklist.ts --add "domena.sk"   # Blacklist
bun scripts/blacklist.ts --list              # Zoznam blacklistu
```

---

## Anti-duplicity — PREČÍTAJ PRED KAŽDÝM DISCOVERY

1. **DB dedup**: Každý beh automaticky stiahne všetky existujúce domény z `leads` tabuľky.
2. **7-dňový guard**: Ak bol daný region+niche scraped menej ako 7 dní dozadu → upozornenie + preskočí. Override: `--force`.
3. **Blacklist**: Dve vrstvy — globálny blacklist v DB (`domain_blacklist`) + niche-špecifické `blacklist_keywords` z `references/niche-templates.md`.
4. **In-run dedup**: `Set<string>` zabraňuje duplicitám v rámci jedného behu.

---

## Chybové stavy & čo robiť

| Chyba | Riešenie |
|---|---|
| `❌ CHÝBAJÚ ENV PREMENNÉ` | Skontroluj `.env` v project roote, pozri `references/setup.md` |
| `429 Too Many Requests` | Pozri `references/rate-limits.md` — čakaj X sekúnd |
| `Scraping padá na N. regióne` | Spusti znova s `--resume` — pokračuje kde skončil |
| `Enrichment timeout` | Normálne — web nedostupný, lead sa preskočí |
| `Smartlead API error` | Pozri `references/debug-guide.md` |

---

## DB schéma (pre referenciu)

```
leads               — všetky scrapnuté/enrichnuté firmy
niches              — konfigurácia niche (keywords, regions, campaign ID)
niche_stats         — denné štatistiky per niche
domain_blacklist    — globálny blacklist domén [NEEXISTUJE NATÍVNE → vytvorí db-status.ts]
resume_state        — stav prebiehajúcich behov (pre --resume flag)
system_settings     — on/off prepínače (leadgen_active, ai_replies_active)
```

---

## Príkazy — rýchla referencia

```bash
# Discovery
bun scripts/discovery.ts --niche "stavebniny" --region "Bratislava" --source both
bun scripts/discovery.ts --niche "realitky" --region all-slovakia --resume --quiet
bun scripts/discovery.ts --niche "test" --region "Košice" --dry-run

# Enrichment
bun scripts/enrich.ts --all-pending
bun scripts/enrich.ts --niche "stavebniny" --limit 50

# Validácia
bun scripts/validate.ts --niche "stavebniny"

# Inject
bun scripts/inject.ts --niche "stavebniny" --min-score 70 --create-campaign --use-ai-sequences
bun scripts/inject.ts --niche "stavebniny" --campaign-id 12345 --dry-run

# Blacklist
bun scripts/blacklist.ts --add "konkurencia.sk"
bun scripts/blacklist.ts --list
bun scripts/blacklist.ts --remove "firma.sk"

# Export
bun scripts/export.ts --niche "stavebniny" --status enriched --output ./export.csv

# Prehľad
bun scripts/db-status.ts

# Celý pipeline
bun scripts/full-pipeline.ts --niche "stavebniny" --region "Bratislava"
```

---

## Dôležité pravidlá

1. **VŽDY čítaj `references/niche-templates.md`** ak user zadá niche — nezavadzaj keyword sám.
2. **NIKDY nespúšťaj inject** bez toho aby si najprv overil scoring (`validate.ts`).
3. **Pri all-slovakia používaj `--resume`** — 35 miest, beh môže trvať dlho.
4. **Ak user nezadá `--source`** → default je `both` (Maps aj Serper).
5. **`--dry-run` je tvoj priateľ** pri testovaní nových niche.

---

## 🤖 Generovanie AI obsahu (BEZ API kľúča)

Toto je najdôležitejšia sekcia. **Ty (Claude) si AI engine.** Žiadne externé API volania nie sú potrebné.

### Icebreakery — workflow (3 kroky)

**Krok 1:** Export leadov bez icebreakeru do pracovného súboru
```bash
bun scripts/prep-for-ai.ts --niche "stavebniny" --output ./ai-work-stavebniny.md
```

**Krok 2:** Prečítaj `ai-work-stavebniny.md`. Pre každú firmu:
- Prečítaj webovú URL, obchodné fakty, meno decision makera
- Vygeneruj 1–2 veticový icebreaker v slovenčine
- Musí byť **konkrétny** o danej firme, nie generický
- Štýl: `"Zaujalo ma, že sa špecializujete na prefabrikované stropné systémy..."` 
- Ulož všetky icebreakery do `icebreakers-stavebniny.json`:
  ```json
  [
    { "id": "uuid-firmy", "icebreaker": "Zaujalo ma, že..." },
    ...
  ]
  ```

**Krok 3:** Zapíš späť do DB
```bash
bun scripts/write-icebreakers.ts --input ./icebreakers-stavebniny.json
```

---

### Email sekvencie — workflow

Keď `inject.ts --create-campaign`, vygeneruješ sekvencie **sám**:

1. Prečítaj `references/campaign-sequences.md` pre formát
2. Prečítaj `references/niche-templates.md` pre niche kontext
3. Vygeneruj JSON s A/B variantmi (krok 1) + followup (krok 2)
4. Ulož do `sequences-[niche].json`
5. Volaj inject s `--sequences-file`:
```bash
bun scripts/inject.ts --niche "stavebniny" --sequences-file ./sequences-stavebniny.json
```

#### Pravidlá pre sekvencie
- **Krok 1**: Variant A + B (líšia sa IBA predmetom)
- **Krok 2 (followup)**: prázdny predmet, krátky, ľudský tón
- Premenné: `{{company_name}}`, `{{last_name_with_salutation}}`, `{{personalized_intro}}`, `%signature%`, `%sender-firstname%`
- **Nikdy** nemeň `%signature%` ani `%sender-firstname%`

---

### Rozhodovací strom pre AI obsah

| User hovorí | Čo spraviť |
|---|---|
| "Generuj icebreakery" | `prep-for-ai.ts` → ty vygeneruješ → `write-icebreakers.ts` |
| "Enrichni a napíš icebreakery" | `enrich.ts` → `prep-for-ai.ts` → ty vygeneruješ → `write-icebreakers.ts` |
| "Vytvor kampaň s AI textami" | Vygeneruješ `sequences.json` → `inject.ts --sequences-file` |
| "Celý pipeline" | `full-pipeline.ts` + manuálne generovanie medzi enrich a inject |

