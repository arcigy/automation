# Debug Guide — Čo robiť keď niečo zlyhá

## 1. Config / ENV chyby

```
❌ CHYBA: Chýbajú povinné ENV premenné:
   • GOOGLE_MAPS_API_KEY
```
→ Skontroluj `.env` v project roote (`C:\Users\laube\Downloads\AUTOMATIZACIE\.env`)
→ Skopíruj `.env.example` ak neexistuje: `cp .env.example .env`
→ Pozri `references/setup.md` pre hodnoty

---

## 2. Discovery padá

**Google Maps vracia 0 výsledkov:**
```
📡 [MAPS] "stavebniny Bratislava" → 0 výsledkov
```
→ Skontroluj či GOOGLE_MAPS_API_KEY má povolené Places API v Google Cloud Console
→ Skús `--source serper` dočasne

**Serper vracia 403:**
```
⚠️ [SERPER] "..." zlyhalo: 403
```
→ Skontroluj kredit na serper.dev, prípadne prejdi na `--source maps`

**All-Slovakia sa zastaví na 40. regióne:**
→ Spusti znova s `--resume`:
```bash
bun scripts/discovery.ts --niche [niche] --region all-slovakia --resume
```

---

## 3. Enrichment zlyhá

**Timeout na webe:**
```
❌ [ENRICH] firmaxyz.sk → Request timeout
```
→ Normálne — web nedostupný. Lead sa automaticky preskočí (status = failed).

**Enrichment nájde iba info@ emaily:**
→ Firmy v tejto niche typicky nemajú osobné emaily na webe.
→ Zvyš `--min-score` na filter pri inject-e (generické emaily dostanú −20 bodov).

---

## 4. Inject zlyhá

**Smartlead Bad Request 400:**
```json
{"message": "Bad Request", "statusCode": 400}
```
→ Skontroluj formát v `inject.ts` — `email` a `first_name` sú povinné.
→ Pozri `references/campaign-sequences.md` pre správnu štruktúru.
→ Skontroluj `docs/smartlead-working-structures.md` v project roote.

**Kampaň neexistuje:**
```
❌ Kampaň nenájdená. Použi --campaign-id alebo --create-campaign.
```
→ Spusti s `--create-campaign`

**Žiadne leady nespĺňajú min-score:**
```
⚠️ Žiadne leady nespĺňajú min-score. Koniec.
```
→ Spusti `bun scripts/validate.ts --niche [niche]` a pozri rozdelenie
→ Znížiž `--min-score` alebo spusti viac enrichmentu

---

## 5. DB problémy

**Tabuľka neexistuje:**
```
ERROR: relation "domain_blacklist" does not exist
```
→ Spusti `bun scripts/db-status.ts` — automaticky vytvorí chýbajúce tabuľky.

**Duplikát primary key:**
```
ERROR: duplicate key value violates unique constraint "leads_website_key"
```
→ Normálne — discovery má ON CONFLICT DO NOTHING, tento error by nemal vzniknúť.
→ Ak vznikne, kontaktuj vývojára.

---

## 6. Rýchly debug checklist

```bash
# 1. Overí ENV a vypíše DB stav
bun scripts/db-status.ts

# 2. Test bez ukladania
bun scripts/discovery.ts --niche [niche] --region Bratislava --dry-run --verbose

# 3. Pozri blacklist
bun scripts/blacklist.ts --list

# 4. Skontroluj scoring
bun scripts/validate.ts --niche [niche] --verbose
```
