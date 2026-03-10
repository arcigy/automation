import * as fs from 'fs';
import * as path from 'path';

async function run() {
    try {
        const payloadPath = process.argv[2];
        if (!payloadPath) {
            console.error("Usage: npx tsx runner.ts automations/X/payload.json");
            process.exit(1);
        }

        const absolutePath = path.resolve(payloadPath);
        const segments = absolutePath.split(path.sep);
        const automationName = segments[segments.length - 2];
        
        console.log(`Loading automation: ${automationName}`);
        const handlerPath = `./automations/${automationName}/handler.ts`;
        
        const { handler } = await import(handlerPath);
        const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        
        console.log(`Running with payload: ${payloadPath}`);
        const res = await handler(payload);
        
        // Save to file for easy viewing
        fs.writeFileSync('out3.json', JSON.stringify(res, null, 2));
        console.log("RESULT SAVED TO out3.json");
        console.log("SHORT RESULT:", JSON.stringify({ success: res.success, count: res.data?.count || res.data?.leads?.length }, null, 2));

    } catch(e: any) {
        console.error("ERROR:", e.message);
        if (e.message.includes('MODULE_NOT_FOUND')) {
            console.error("Possible cause: Handler not found at the expected path.");
        }
    }
}
run();
