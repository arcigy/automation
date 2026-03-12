import { fetchTool } from "../../tools/http/fetch.tool";
import { env } from "../../core/env";

export interface SlackMessageInput {
  channel?: string; // required if using Bot Token
  text: string;
  blocks?: any[];
}

export async function slackSendMessageTool(input: SlackMessageInput): Promise<void> {
  const botToken = env.SLACK_BOT_TOKEN;
  const webhookUrl = env.SLACK_WEBHOOK_URL;

  // Prefer Bot Token if available (allows interactive components and multiple channels)
  if (botToken) {
    try {
      await fetchTool({
        url: "https://slack.com/api/chat.postMessage",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${botToken}`,
          "Content-Type": "application/json"
        },
        body: {
          channel: input.channel || "#leadgen", // default channel
          text: input.text,
          blocks: input.blocks
        }
      });
      return;
    } catch (e) {
      console.warn("⚠️ Slack Bot API failed, falling back to webhook...", e);
    }
  }

  // Fallback to Webhook
  if (webhookUrl) {
    await fetchTool({
      url: webhookUrl,
      method: "POST",
      body: {
        text: input.text,
        blocks: input.blocks
      }
    });
  } else {
    console.warn("⚠️ No SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL found in .env");
  }
}
