# Automation: lead-generator

## Čo robí

Vyhľadáva potenciálnych leadov pomocou kombinácie Google Maps a Serper.

- **Google Maps**: Získava mená firiem, telefónne čísla a webové stránky priamo z mapových podkladov.
- **Serper**: Vyhľadáva organické výsledky na Google pre širší záber.

Implementovaná je **rotácia 3 Google Maps kľúčov**, aby sme obišli denné limity (300/key).

## Trigger

- Typ: manual / API trigger
- Endpoint: `POST /trigger/lead-generator`

## Vstupné dáta (schema.ts)

- `query`: Čo hľadáme (napr. "Zubné ambulancie Bratislava").
- `limit`: Počet výsledkov zo Serperu (default 20).
- `use_maps`: Či použiť Google Maps (default true).
- `use_serper`: Či použiť Serper (default true).

## Používa tools

- `tools/google/maps-search.tool.ts` — s rotáciou kľúčov.
- `tools/google/serper-search.tool.ts` — pre organický search.
