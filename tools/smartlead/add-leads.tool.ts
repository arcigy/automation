import { env } from "../../core/env";
import { fetchTool } from "../http/fetch.tool";

export interface SmartleadLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  website?: string;
  custom_fields?: Record<string, string | number | boolean>;
}

export interface AddLeadsInput {
  campaignId: number;
  leads: SmartleadLead[];
}

export async function smartleadAddLeadsTool(input: AddLeadsInput) {
  const url = `https://server.smartlead.ai/api/v1/campaigns/${input.campaignId}/leads?api_key=${env.SMARTLEAD_API_KEY}`;
  
  // Smartlead maximum batch is 100 leads per request
  const batchSize = 100;
  const results = [];

  for (let i = 0; i < input.leads.length; i += batchSize) {
    const batch = input.leads.slice(i, i + batchSize);
    
    const response = await fetchTool({
      url,
      method: "POST",
      body: {
        lead_list: batch
      }
    });

    if (response.status !== 200) {
      throw new Error(`Smartlead API error: ${response.status} ${JSON.stringify(response.data)}`);
    }
    
    results.push(response.data);
  }

  return results;
}
