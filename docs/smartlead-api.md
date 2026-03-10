# Smartlead API Reference

## Autentifikácia

- Base URL: https://server.smartlead.ai/api/v1
- API key: VŽDY query param ?api_key=KEY, NIKDY header
- Rate limit: 10 requestov za 2 sekundy

## Kľúčové endpointy

### Kampane

GET /campaigns?api_key= → zoznam všetkých kampaní
GET /campaigns/{id}?api_key= → detail kampane

### Leads

GET /campaigns/{id}/leads?api_key=&offset=0&limit=100 → leads kampane
Response: { data: Lead[] } alebo Lead[] priamo
Lead fields: id, email, first_name, last_name, status, replied (bool), replied_count

### Message History (KĽÚČOVÉ pre reply)

GET /campaigns/{id}/leads/message-history?api_key=&email={email}
Vracia array správ pre konkrétneho leada v kampani
Každá správa má: stats_id, message_id, email_body, subject, send_time, type
type hodnoty: "EMAIL_SENT" | "EMAIL_REPLY" | "EMAIL_OPEN"
Použi posledný EMAIL_SENT na získanie: email_stats_id, reply_message_id, reply_email_time

### Reply na email (HLAVNÝ endpoint automatizácie)

POST /campaigns/{id}/reply-email-thread?api_key=
Body:
{
"email_stats_id": "uuid", ← z message-history stats_id
"email_body": "text odpovede",
"reply_message_id": "<xxx@mail.gmail.com>", ← z message-history message_id
"reply_email_time": "ISO timestamp" ← z message-history send_time
}
POZOR: Všetky 3 polia (email_stats_id, reply_message_id, reply_email_time) sú POVINNÉ

### Webhooky

GET /campaigns/{id}/webhooks?api_key= → aktuálne webhooky kampane
POST /campaigns/{id}/webhooks?api_key= → pridaj/uprav webhook
Body: { webhook_url, event_type }
event_type hodnoty: "EMAIL_REPLY" | "LEAD_CATEGORY_UPDATED" | "EMAIL_OPENED" | "EMAIL_CLICKED"

### Webhook payload (čo Smartlead pošle na náš server)

LEAD_CATEGORY_UPDATED event:
{
"to_email": "lead@example.com",
"from_email": "sender@yourdomain.com",
"from_name": "Your Name",
"lead_name": "John Doe",
"campaign_id": 372,
"campaign_name": "My Campaign",
"category_name": "Interested",
"email_body": "text poslednej odpovede leada",
"time": "2024-01-15T10:30:00.000Z",
"type": "LEAD_CATEGORY_UPDATED"
}

## Časté chyby

- 401: Zlý API key alebo key nie je query param
- 404: Zlé campaign_id alebo endpoint neexistuje
- 400: Chýbajú povinné polia v body (napr. pri reply)

## Pravidlo pre reply flow

1. VŽDY najprv GET message-history
2. Vyber posledný EMAIL_SENT
3. Použi jeho stats_id → email_stats_id, message_id → reply_message_id, send_time → reply_email_time
4. Potom POST reply-email-thread
