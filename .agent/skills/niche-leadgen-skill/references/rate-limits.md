# Rate Limits & Retry Logika

Claude číta tento súbor vždy keď narazí na `429 Too Many Requests` alebo API error.

## Google Maps Places API

| Limit | Hodnota |
|---|---|
| Requests per second | 50 QPS (Queries Per Second) |
| Requests per day | 150,000 (závisí od billing tier) |
| Cost per request | $0.032 per Text Search |

**Ak vidíš 429:**
```
⚠️ [MAPS] "..." zlyhalo: 429 Too Many Requests
```
→ `discovery.ts` má vbudovaný delay 800ms medzi calls. Ak stále padá, počkaj 60 sekúnd a spusti s `--resume`.

---

## Serper.dev API

| Limit | Hodnota |
|---|---|
| Free tier | 2,500 req/mesiac |
| Requests per second | 1 QPS (voľný) |
| Cost per request | $0.001 (paid) |

**Ak vidíš 403 alebo "credits exhausted":**
→ Skontroluj kredit na serper.dev dashboard. Použi `--source maps` dočasne.

---

## Smartlead API

| Limit | Hodnota |
|---|---|
| Leads per batch | max 100 |
| Requests per minute | ~60 (nezadokumentované) |
| Campaign creation | bez limitu |

**Ak vidíš Smartlead error:**
```json
{ "message": "Bad Request", "statusCode": 400 }
```
→ Skontroluj formát leadov v `inject.ts` — polia `email`, `first_name` sú povinné.
→ Skontroluj `docs/smartlead-working-structures.md` v project roote.

---

## Retry Logika

`discovery.ts` nemá automatický retry (každé zlyhanie sa loguje a pokračuje).
Pre batch retry pri all-slovakia: vždy použi `--resume` pri novom spustení.

```bash
# Po výpadku:
bun scripts/discovery.ts --niche "stavebniny" --region all-slovakia --resume
```

---

## Odporúčané delays (prednastavené v skriptoch)

| API | Delay medzi calls |
|---|---|
| Google Maps | 800ms |
| Serper | 500ms |
| Smartlead upload | 2500ms (batch) |
| Enrichment (scraping) | 300ms |
