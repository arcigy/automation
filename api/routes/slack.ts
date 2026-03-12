import { Hono } from "hono";
import { sql } from "../../core/db";
import { env } from "../../core/env";
import { slackSendMessageTool } from "../../tools/slack/send-message.tool";

const slack = new Hono();

slack.post("/interactivity", async (c) => {
  const body = await c.req.parseBody();
  const payload = JSON.parse(body.payload as string);

  const action = payload.actions[0];
  const actionId = action.action_id;

  if (actionId === "toggle_leadgen") {
    const currentState = await sql`SELECT value FROM system_settings WHERE key = 'leadgen_active'`;
    const newState = !currentState[0].value;
    await sql`UPDATE system_settings SET value = ${newState} WHERE key = 'leadgen_active'`;
    
    return c.json({
      text: `✅ Lead Generation & Campaign Create: *${newState ? "AKTÍVNY" : "POZASTAVENÝ"}*`,
      replace_original: true
    });
  }

  if (actionId === "toggle_ai_replies") {
    const currentState = await sql`SELECT value FROM system_settings WHERE key = 'ai_replies_active'`;
    const newState = !currentState[0].value;
    await sql`UPDATE system_settings SET value = ${newState} WHERE key = 'ai_replies_active'`;

    return c.json({
      text: `✅ AI Replies: *${newState ? "AKTÍVNY" : "POZASTAVENÝ"}*`,
      replace_original: true
    });
  }

  return c.json({ status: "ok" });
});

// Helper to send the control panel
slack.get("/control-panel", async (c) => {
  const settings = await sql`SELECT key, value FROM system_settings`;
  const leadgen = settings.find(s => s.key === 'leadgen_active')?.value;
  const aiReplies = settings.find(s => s.key === 'ai_replies_active')?.value;

  await slackSendMessageTool({
    text: "🎮 *Arcigy Automation Control Panel*",
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: "🎮 *Arcigy Automation Control Panel*\nTu môžeš ovládať hlavné súčasti systému." }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: leadgen ? "⏸️ Pozastaviť Leadgen" : "🚀 Spustiť Leadgen" },
            style: leadgen ? "danger" : "primary",
            action_id: "toggle_leadgen"
          },
          {
            type: "button",
            text: { type: "plain_text", text: aiReplies ? "⏸️ Pozastaviť AI Replies" : "🚀 Spustiť AI Replies" },
            style: aiReplies ? "danger" : "primary",
            action_id: "toggle_ai_replies"
          }
        ]
      }
    ]
  });

  return c.json({ status: "sent" });
});

export { slack as slackRoutes };
