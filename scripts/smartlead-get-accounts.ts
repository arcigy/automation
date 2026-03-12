import { env } from '../core/env';
import { fetchTool } from '../tools/http/fetch.tool';

async function main() {
  const apiKey = env.SMARTLEAD_API_KEY;
  const baseUrl = "https://server.smartlead.ai/api/v1";

  // Get email accounts
  console.log("=== Email Accounts ===");
  const accounts = await fetchTool({
    url: `${baseUrl}/email-accounts?api_key=${apiKey}`,
    method: 'GET'
  });
  console.log(JSON.stringify(accounts.data, null, 2));
  process.exit(0);
}

main().catch(console.error);
