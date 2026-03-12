import { env } from '../core/env';
import { fetchTool } from '../tools/http/fetch.tool';

async function main() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  const accounts = await fetchTool({
    url: `${baseUrl}/email-accounts?api_key=${apiKey}`,
    method: 'GET'
  });
  
  if (Array.isArray(accounts.data)) {
    console.log("=== EMAIL ACCOUNTS FOUND ===");
    accounts.data.forEach((acc: any) => {
      console.log(`ID: ${acc.id} | Email: ${acc.from_email} | Status: ${acc.warmup_details?.status || 'N/A'}`);
    });
  } else {
    console.log("Unexpected data format:", accounts.data);
  }
  process.exit(0);
}

main().catch(console.error);
