# a.k.a. Gemini Call Tool

Toto je core tool pre komunikáciu s Google Gemini modelmi vo vnútri tohto automatizačného systému.
Obaľuje volanie do `@google/genai` balíčka a jednotne loguje alebo spracováva input/output.

## Použitie v handleri

```typescript
import { geminiCallTool } from "../../tools/ai/gemini-call.tool";

const result = await geminiCallTool({
  systemPrompt: "You are a helpful assistant",
  userMessage: "What is 2+2?",
  model: "gemini-3.0-flash-preview",
  maxTokens: 500,
});

console.log(result.content);
console.log(result.inputTokens);
console.log(result.outputTokens);
```

### Parametre (Input)

- `systemPrompt` (povinný): Systémová inštrukcia (správanie)
- `userMessage` (povinný): Text od používateľa, na ktorý chceme reagovať
- `model` (nepovinný): Názov modelu, predvolené je `gemini-3.0-flash-preview`
- `maxTokens` (nepovinný): Koľko tokenov max môže vygenerovať. Predvolené `1024`.

### Výstup

- `content`: Text vygenerovaný modelom
- `inputTokens`: Prompt tokens metadata
- `outputTokens`: Candidate tokens metadata
