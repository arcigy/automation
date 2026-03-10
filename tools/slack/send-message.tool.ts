import { fetchTool } from "../http/fetch.tool";

export interface SlackMessageInput {
  webhookUrl: string;
  text: string;
  blocks?: unknown[];
}

export async function slackSendMessageTool(
  input: SlackMessageInput,
): Promise<void> {
  const result = await fetchTool({
    url: input.webhookUrl,
    method: "POST",
    body: { text: input.text, blocks: input.blocks },
  });
  if (result.status !== 200) {
    throw new Error(`Slack API error: ${result.status}`);
  }
}
