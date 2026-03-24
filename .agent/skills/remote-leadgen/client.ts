/**
 * remote-leadgen/client.ts — HTTP API client for Railway-hosted leadgen
 * Provides TypeScript interface to all leadgen endpoints
 */

interface ClientConfig {
  apiUrl: string;
  apiKey: string;
}

interface DiscoveryParams {
  niche: string;
  region: string;
  source?: "maps" | "serper";
  target?: number;
  dryRun?: boolean;
}

interface EnrichParams {
  niche?: string;
  limit?: number;
  allPending?: boolean;
}

interface ValidateParams {
  niche: string;
}

interface InjectParams {
  niche: string;
  minScore?: number;
  createCampaign?: boolean;
  dryRun?: boolean;
}

interface PrepForAiParams {
  niche: string;
}

interface WriteIcebreakersParams {
  icebreakers: Array<{ id: string; icebreaker: string }>;
}

interface BlacklistParams {
  action: "add" | "remove" | "list";
  domain?: string;
}

class LeadgenClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    if (!config.apiUrl || !config.apiKey) {
      throw new Error(
        "Missing LEADGEN_API_URL or LEADGEN_API_KEY environment variables"
      );
    }
    this.config = config;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: object
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: HeadersInit = {
      "x-api-key": this.config.apiKey,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(
          `API Error ${response.status}: ${await response.text()}`
        );
      }

      return (await response.json()) as T;
    } catch (error: any) {
      console.error(`Failed to call ${endpoint}:`, error.message);
      throw error;
    }
  }

  async health(): Promise<{ status: string }> {
    return this.request("GET", "/health");
  }

  async status(niche?: string): Promise<any> {
    const url = niche ? `/status?niche=${niche}` : "/status";
    return this.request("GET", url);
  }

  async discovery(params: DiscoveryParams): Promise<any> {
    return this.request("POST", "/discovery", params);
  }

  async enrich(params: EnrichParams): Promise<any> {
    return this.request("POST", "/enrich", params);
  }

  async validate(params: ValidateParams): Promise<any> {
    return this.request("POST", "/validate", params);
  }

  async inject(params: InjectParams): Promise<any> {
    return this.request("POST", "/inject", params);
  }

  async prepForAi(params: PrepForAiParams): Promise<{ data: string }> {
    return this.request("POST", "/prep-for-ai", params);
  }

  async writeIcebreakers(params: WriteIcebreakersParams): Promise<any> {
    return this.request("POST", "/write-icebreakers", params);
  }

  async export(niche: string): Promise<any> {
    return this.request("GET", `/export?niche=${niche}`);
  }

  async blacklist(params: BlacklistParams): Promise<any> {
    return this.request("POST", "/blacklist", params);
  }
}

// Usage
if (import.meta.main) {
  const client = new LeadgenClient({
    apiUrl: process.env.LEADGEN_API_URL || "http://localhost:3000",
    apiKey: process.env.LEADGEN_API_KEY || "",
  });

  (async () => {
    try {
      // Test health
      const health = await client.health();
      console.log("✅ Health:", health);

      // Get status
      if (process.env.LEADGEN_API_KEY) {
        const status = await client.status();
        console.log("📊 Status:", status);
      }
    } catch (error) {
      console.error("❌ Error:", error);
    }
  })();
}

export { LeadgenClient, ClientConfig };
