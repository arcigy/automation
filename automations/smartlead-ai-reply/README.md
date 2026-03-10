# smartlead-ai-reply

Automatická AI odpoveď na pozitívne cold email odpovede cez Smartlead.ai.

## Flow

1. Smartlead detekuje "Interested" kategoriu leada → pošle webhook
2. Handler fetchne message history pre povinné reply polia
3. AI vygeneruje krátku personalizovanú odpoveď (max 3 vety)
4. Odpoveď sa odošle do email vlákna cez Smartlead API
5. Run sa zaloguje do automation_logs

## Nastavenie webhookov v Smartlead

1. Choď na Settings → Webhooks → Add Webhook
2. URL: https://tvoja-railway-url.railway.app/webhook/smartlead-ai-reply
3. Event type: LEAD_CATEGORY_UPDATED
4. Kategórie: Interested (prípadne ďalšie pozitívne)
5. Header: x-api-key → tvoj API_SECRET_KEY

## Potrebné env premenné

SMARTLEAD_API_KEY= ← Settings → API v Smartlead

## Test payload pre terminál

./scripts/trigger.sh smartlead-ai-reply test-payload.json

test-payload.json:
{
"to_email": "lead@example.com",
"from_email": "you@yourdomain.com",
"lead_name": "John Doe",
"campaign_id": "372",
"campaign_name": "Test Campaign",
"category_name": "Interested",
"email_body": "Hey, this looks interesting! Tell me more.",
"type": "LEAD_CATEGORY_UPDATED"
}

## Dry-run testovanie

### Dry-run test (bez odoslania emailu)

Vytvor súbor: `automations/smartlead-ai-reply/test-payload.dry-run.json`

```json
{
  "to_email": "REAL_LEAD_EMAIL_Z_TVOJEJ_KAMPANE",
  "from_email": "tvoj@email.com",
  "lead_name": "Meno Leada",
  "campaign_id": "REAL_CAMPAIGN_ID",
  "campaign_name": "Názov kampane",
  "category_name": "Interested",
  "email_body": "Hey, this looks interesting!",
  "type": "LEAD_CATEGORY_UPDATED",
  "dry_run": true
}
```

Spusti:
`./scripts/trigger.sh smartlead-ai-reply automations/smartlead-ai-reply/test-payload.dry-run.json`

Čo overí dry-run:
✓ Smartlead message-history API je dostupné a vracia správne polia
✓ AI vygeneruje zmysluplnú odpoveď pre daný lead
✓ Vidíš čo by bolo odoslané — pred živým nasadením
✓ Log v automation_logs s názvom "smartlead-ai-reply:dry-run"
✗ Email sa NEODOŠLE

Po overení dry-runu spusti rovnaký payload bez `dry_run: true` pre live test.
