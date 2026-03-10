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

## Konvencie

- Tools: [akcia].tool.ts
- Handler: vždy handler.ts
- Schema: vždy schema.ts

## Ako pridať automatizáciu

1. ./scripts/new-automation.sh [nazov]
2. Vyplniť schema.ts
3. Napísať handler.ts — používaj tools z tools/
4. Otestovať: ./scripts/trigger.sh [nazov] payload.json

## automation_logs schéma

id, run_id, automation_name, status, payload, result, error, duration_ms, created_at

## Externé API docs

- docs/smartlead-api.md → Smartlead API referencia, čítaj pri každej Smartlead práci
