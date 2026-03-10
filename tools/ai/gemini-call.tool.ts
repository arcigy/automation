import { GoogleGenAI } from "@google/genai";
import { env } from "../../core/env";

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

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function geminiCallTool(input: GeminiCallInput): Promise<GeminiCallOutput> {
  const modelName = input.model ?? "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: "user",
        parts: [{ text: input.userMessage }]
      }
    ],
    config: {
      systemInstruction: input.systemPrompt,
      maxOutputTokens: input.maxTokens ?? 4096,
      temperature: 0.7,
    }
  });

  const content = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return {
    content,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
