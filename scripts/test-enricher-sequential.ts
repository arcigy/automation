import { handler } from "../automations/lead-enricher/handler";
import * as fs from "fs";
import * as path from "path";

async function runTest() {
  const payloadPath = path.join(__dirname, "../tmp/test_payload.json");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8"));

  console.log(`🚀 SEQUENTIAL TEST ENRICHER on ${payload.length} leads...`);

  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    const logFile = path.join(__dirname, `../tmp/test_run_${i}.log`);
    const logStream = fs.createWriteStream(logFile);
    
    // Redirect console.log for this scope
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = (...args) => {
      logStream.write(args.join(" ") + "\n");
      originalLog(...args);
    };
    console.warn = (...args) => {
        logStream.write("[WARN] " + args.join(" ") + "\n");
        originalWarn(...args);
    };
    console.error = (...args) => {
        logStream.write("[ERR] " + args.join(" ") + "\n");
        originalError(...args);
    };

    console.log(`\nSTARTING LEAD ${i}: ${item.website}`);

    try {
      await handler({ 
        leads: [{
          name: item.original_name,
          website: item.website
        }],
        aggressive_scraping: true
      });
      console.log(`FINISHED LEAD ${i}`);
    } catch (e: any) {
      console.error(`CRASHED LEAD ${i}: ${e.message}`);
    } finally {
        logStream.end();
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
    }
  }

  process.exit(0);
}

runTest().catch(console.error);
