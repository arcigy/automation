# Automation: smartlead-create-campaign

## Čo robí

Komplexné vytvorenie kampane v Smartlead. Orchestruje 4 API volania tak, aby kampaň bola po skončení plne nakonfigurovaná a pripravená na odosielanie.

## Používa tools

- `tools/http/fetch.tool.ts` — na volanie postu/patchu do Smartlead API.

## Workflow

1. `POST /campaigns/create` -> vytvorenie.
2. `POST /campaigns/{id}/sequences` -> nahratie textov.
3. `POST /campaigns/{id}/email-accounts` -> priradenie senderov.
4. `PATCH /campaigns/{id}/settings` -> nastavenie schedules a limitov.

## Poznámky

- Ak zlyhá hociktorý krok, kampaň ostane vytvorená, ale nemusí byť kompletná. Error log zachytí, kde nastala chyba.
