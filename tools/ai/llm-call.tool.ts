import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../core/env";

export interface LlmCallInput {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}

export interface LlmCallOutput {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function llmCallTool(input: LlmCallInput): Promise<LlmCallOutput> {
  const response = await client.messages.create({
    model: input.model ?? "claude-3-5-sonnet-20240620",
    max_tokens: input.maxTokens ?? 1024,
    system: input.systemPrompt,
    messages: [{ role: "user", content: input.userMessage }],
  });

  const content = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.Messages.TextBlock).text)
    .join("");

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
