import Anthropic from "@anthropic-ai/sdk";

async function test() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const res = await client.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 100,
      messages: [{ role: "user", content: "Say hi!" }]
    });
    console.log("Res:", (res.content[0] as any).text);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
test();
