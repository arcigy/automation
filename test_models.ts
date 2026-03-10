import { env } from "./core/env";
import { fetchTool } from "./tools/http/fetch.tool";

async function checkModel(modelName: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await fetchTool({
        url,
        method: "POST",
        body: {
            contents: [{ role: "user", parts: [{ text: "hi" }] }]
        }
    });
    console.log(`${modelName}: ${res.status}`, res.status !== 200 ? res.data : "OK");
}

async function run() {
    await checkModel("gemini-1.5-flash");
    await checkModel("gemini-1.5-flash-latest");
    await checkModel("gemini-2.0-flash-exp");
    await checkModel("gemini-pro");
}
run();
