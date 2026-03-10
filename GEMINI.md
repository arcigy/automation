# Automation System — Gemini Context

## Stack

Runtime: Bun | Framework: Hono | Language: TypeScript strict
Database: PostgreSQL (postgres.js) | Cache: Redis (ioredis)
Logging: PostgreSQL tabuľka automation_logs | Deploy: Railway
**Production URL:** `https://automation-arcigy.up.railway.app`

## Pravidlá

1. Tools v tools/ sú VŽDY generické — žiadne hardcoded hodnoty
2. Každá automatizácia žije v automations/[nazov]/
3. ENV premenné VŽDY cez core/env.ts, nikdy process.env priamo
4. Každý run sa loguje cez core/logger.ts → logRun()
5. Vstup vždy validovaný cez Zod v schema.ts
6. API odpovede vždy cez core/response.ts
7. **Kritické pravidlo pre Gemini modely**: `gemini-2.5-flash` je absolútne najstarší model, ktorý funguje. Staršie modely (napr. 1.5) sú zastaralé a vyhadzujú 404 Not Found.
8. **Kľúče (iba pre info, nekódovať natvrdo)**:
   - Lokálny vývoj (vkladá sa do `.env`): `AIzaSyCnGclSdftDsOudOMe04pCBZ46mGqTBcZA`
   - Ostrý Railway kľúč (ZAKÁZANÉ POUŽÍVAŤ LOKÁLNE): `AIzaSyBDI7cQptVKxZNAVlpJMOIBdW2rR1lt0SY`

- Tools: [akcia].tool.ts
- Handler: vždy handler.ts
- Schema: vždy schema.ts

## Lead Generation & Enrichment Tools

- `tools/google/maps-search.tool.ts`: Vyhľadávanie na Google Maps s **rotáciou kľúčov** (3 kľúče).
- `tools/google/serper-search.tool.ts`: Rýchly organický search.
- `tools/scraping/web-scraper.tool.ts`: Agresívny scraper (homepage + podstránky) pre emaily a text.

## Automations

- `lead-enricher`: Deduplikácia podľa domény, scrape webu a AI extrakcia Decision Makera a faktov o firme s verifikáciou halucinácií.

## Ako pridať automatizáciu

1. ./scripts/new-automation.sh [nazov]
2. Vyplniť schema.ts
3. Napísať handler.ts — používaj tools z tools/
4. Otestovať: ./scripts/trigger.sh [nazov] payload.json

## automation_logs schéma

id, run_id, automation_name, status, payload, result, error, duration_ms, created_at

## Externé API docs

- docs/smartlead-api.md → Smartlead API referencia, čítaj pri každej Smartlead práci
