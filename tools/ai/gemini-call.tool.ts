import { env } from "../../core/env";
import { fetchTool } from "../http/fetch.tool";

export interface GeminiCallInput {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}

export interface GeminiCallOutput {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export async function geminiCallTool(input: GeminiCallInput): Promise<GeminiCallOutput> {
  const modelName = input.model ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: input.userMessage }]
      }
    ],
    system_instruction: {
      parts: [{ text: input.systemPrompt }]
    },
    generationConfig: {
      maxOutputTokens: input.maxTokens ?? 4096,
      temperature: 0.7
    }
  };

  const response = await fetchTool({
    url,
    method: "POST",
    body
  });

  if (response.status !== 200) {
    throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(response.data)}`);
  }

  const data = response.data as any;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return {
    content,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
