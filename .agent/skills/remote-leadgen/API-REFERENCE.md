# Remote Leadgen API — Quick Reference

## Base URL
```
https://automation-arcigy.up.railway.app
```

## Auth Header (all requests except /health)
```
x-api-key: <LEADGEN_API_KEY>
```

---

## Endpoints

### 1. Health Check
```
GET /health
```
**No auth required**

```bash
curl https://automation-arcigy.up.railway.app/health
```

---

### 2. Status — DB Stats
```
GET /status?niche=<niche>
```

```bash
curl -H "x-api-key: YOUR_KEY" \
  https://automation-arcigy.up.railway.app/status

# Specific niche
curl -H "x-api-key: YOUR_KEY" \
  https://automation-arcigy.up.railway.app/status?niche=plumber
```

---

### 3. Discovery — Scraping
```
POST /discovery
```

```bash
curl -X POST https://automation-arcigy.up.railway.app/discovery \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "niche": "plumber",
    "region": "bratislava",
    "source": "maps",
    "target": 50,
    "dryRun": false
  }'
```

---

### 4. Enrich — AI Enhancement
```
POST /enrich
```

```bash
curl -X POST https://automation-arcigy.up.railway.app/enrich \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "niche": "plumber",
    "limit": 20,
    "allPending": false
  }'
```

---

### 5. Validate — Quality Check
```
POST /validate
```

```bash
curl -X POST https://automation-arcigy.up.railway.app/validate \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"niche": "plumber"}'
```

---

### 6. Inject — Smartlead Upload
```
POST /inject
```

```bash
curl -X POST https://automation-arcigy.up.railway.app/inject \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "niche": "plumber",
    "minScore": 70,
    "createCampaign": true,
    "dryRun": false
  }'
```

---

### 7. Prep for AI — Markdown Export
```
POST /prep-for-ai
```

```bash
curl -X POST https://automation-arcigy.up.railway.app/prep-for-ai \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"niche": "plumber"}'
```

Returns markdown with all leads for AI processing.

---

### 8. Write Icebreakers — Email Templates
```
POST /write-icebreakers
```

```bash
curl -X POST https://automation-arcigy.up.railway.app/write-icebreakers \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "icebreakers": [
      {"id": "lead-1", "icebreaker": "Hi, noticed your plumbing services..."},
      {"id": "lead-2", "icebreaker": "Hey, saw your work on Google Maps..."}
    ]
  }'
```

---

### 9. Export — CSV/JSON
```
GET /export?niche=<niche>
```

```bash
curl -H "x-api-key: YOUR_KEY" \
  https://automation-arcigy.up.railway.app/export?niche=plumber
```

---

### 10. Blacklist — Domain Management
```
POST /blacklist
```

**Add to blacklist:**
```bash
curl -X POST https://automation-arcigy.up.railway.app/blacklist \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "add", "domain": "amazon.sk"}'
```

**Remove from blacklist:**
```bash
curl -X POST https://automation-arcigy.up.railway.app/blacklist \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "remove", "domain": "amazon.sk"}'
```

**List blacklist:**
```bash
curl -X POST https://automation-arcigy.up.railway.app/blacklist \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}'
```

---

## Error Responses

| Code | Meaning | Fix |
|------|---------|-----|
| 200 | OK | Success! |
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Wrong/missing API key |
| 404 | Not Found | Wrong endpoint |
| 500 | Server Error | Check Railway logs |

---

## Response Format (all successful requests)

```json
{
  "status": "ok",
  "data": "<output or results>"
}
```

---

## Environment Variables

Store these in Railway secrets or `.env.local`:

```
LEADGEN_API_URL=https://automation-arcigy.up.railway.app
LEADGEN_API_KEY=<tvoj-GEMINI_API_KEY>
```

---

## Typical Workflow

1. **Check Status**
   ```bash
   GET /status
   ```

2. **Run Discovery**
   ```bash
   POST /discovery {niche, region, ...}
   ```

3. **Validate Results**
   ```bash
   POST /validate {niche}
   ```

4. **Prep for AI** (if needed)
   ```bash
   POST /prep-for-ai {niche}
   ```

5. **Write Icebreakers** (if needed)
   ```bash
   POST /write-icebreakers {icebreakers}
   ```

6. **Inject to Smartlead**
   ```bash
   POST /inject {niche, minScore, ...}
   ```

7. **Verify**
   ```bash
   GET /status?niche=<niche>
   ```
