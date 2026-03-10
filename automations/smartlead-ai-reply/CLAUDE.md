# Automation: smartlead-ai-reply

## Čo robí

Prijme Smartlead LEAD_CATEGORY_UPDATED webhook, fetchne message history
pre správne reply polia, vygeneruje AI odpoveď a odošle ju cez Smartlead API.
Cieľ: doviesť leada na https://www.arcigy.com/showcase kde si zarezervuje call.

## Trigger

- Typ: webhook
- Endpoint: POST /webhook/smartlead-ai-reply
- Event: LEAD_CATEGORY_UPDATED (kategória: Interested)

## ⚠️ Smartlead API špecifiká — KRITICKÉ

1. API key = VŽDY query param ?api_key=, NIKDY header
2. Reply endpoint VYŽADUJE pred-fetch z message-history:
   - email_stats_id (stats_id posledného odoslaného emailu)
   - reply_message_id (message_id posledného odoslaného emailu)
   - reply_email_time (send_time posledného odoslaného emailu)
3. message-history endpoint: GET /campaigns/{id}/leads/message-history?api_key=&email=

## Flow

1. Webhook → validácia Zod schémy
2. GET message-history → extrakcia email_stats_id, reply_message_id, reply_email_time
3. AI generuje odpoveď (llm-call.tool)
4. POST reply-email-thread s kompletnými poliami
5. logRun → automation_logs

## Env premenné

SMARTLEAD_API_KEY — Settings → API v Smartlead dashboarde

## Edge cases

- Ak message-history neobsahuje žiadny EMAIL_SENT → error s popisom
- Ak lead_name chýba → greeting "Hey,"
- AI detekuje jazyk z email_body a odpovedá v rovnakom jazyku
