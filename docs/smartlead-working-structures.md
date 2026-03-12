# Smartlead Working API Structures

This document contains verified JSON structures for Smartlead API (v1).

## 1. Create Campaign
**POST** `/campaigns/create?api_key=...`
```json
{
  "name": "Campaign Name",
  "client_id": null
}
```

## 2. Add Sequences (A/B Testing Structure)
**POST** `/campaigns/{id}/sequences?api_key=...`
Structure required for `handler.ts`:
```json
{
  "sequences": [
    {
      "seq_number": 1,
      "seq_delay_details": { "delay_in_days": 0 },
      "seq_variants": [
        {
          "variant_label": "A",
          "subject": "Email Subject",
          "email_body": "<p>HTML Body</p>"
        }
      ]
    },
    {
      "seq_number": 2,
      "seq_delay_details": { "delay_in_days": 3 },
      "seq_variants": [
        {
          "variant_label": "A",
          "subject": "", 
          "email_body": "<p>Followup Body</p>"
        }
      ]
    }
  ]
}
```
*Note: Followups (seq > 1) usually have empty subjects to stay in thread.*

## 3. Link Email Accounts
**POST** `/campaigns/{id}/email-accounts?api_key=...`
```json
{
  "email_account_ids": [14382544, 14382530, 14382508, 14382300]
}
```

## 4. Update Schedule
**POST** `/campaigns/{id}/schedule?api_key=...`
```json
{
  "timezone": "Europe/Bratislava",
  "start_hour": "08:00",
  "end_hour": "18:00",
  "days_of_the_week": [1, 2, 3, 4, 5],
  "max_new_leads_per_day": 30,
  "min_time_btw_emails": 15,
  "schedule_start_time": null
}
```

## 5. Update Settings
**PATCH** `/campaigns/{id}/settings?api_key=...`
```json
{
  "track_settings": ["DONT_TRACK_EMAIL_OPEN"],
  "stop_lead_settings": "REPLY_TO_AN_EMAIL",
  "follow_up_percentage": 100
}
```

## 6. Add Webhook
**POST** `/campaigns/{id}/webhooks?api_key=...`
```json
{
  "id": null,
  "name": "Webhook Name",
  "webhook_url": "https://your-domain.com/webhook",
  "event_types": ["LEAD_CATEGORY_UPDATED", "EMAIL_REPLY"]
}
```

## 7. Upload Leads
**POST** `/campaigns/{id}/leads?api_key=...`
```json
{
  "lead_list": [
    {
      "email": "lead@example.com",
      "first_name": "First",
      "last_name": " Last",
      "company_name": "Company",
      "website": "example.com",
      "custom_fields": {
        "personalized_intro": "Icebreaker here",
        "ico": "12345678"
      }
    }
  ],
  "settings": {
    "ignore_global_block_list": false,
    "ignore_unsubscribe_list": false
  }
}
```
*Note: batch size limit is 100 per request.*
