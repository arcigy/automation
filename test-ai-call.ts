import { llmCallTool } from "./tools/ai/llm-call.tool";
import { sql } from "./core/db";

async function test() {
  const name = "Autoservis Cehula, s.r.o.";
  const web = "https://autoserviscehula.sk/";
  const facts = "";
  
  const systemPrompt = `Si špičkový B2B copywriter. Napíš 1 úvodnú vetu (icebreaker) pre email autoservisu. Slovenčina. MAX 1 VETA.`;
  const userMessage = `Firma: ${name}, Web: ${web}, Fakty: ${facts}`;

  try {
    const res = await llmCallTool({
      systemPrompt,
      userMessage,
      model: "claude-3-5-sonnet-20240620"
    });
    console.log("Response:", res.content);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}

test();
