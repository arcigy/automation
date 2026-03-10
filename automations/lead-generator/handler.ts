import { inputSchema, type Input, type Output, type Lead } from "./schema";
import { logRun } from "../../core/logger";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { googleMapsSearchTool } from "../../tools/google/maps-search.tool";
import { serperSearchTool } from "../../tools/google/serper-search.tool";

export async function handler(
  rawInput: unknown,
): Promise<AutomationResult<Output>> {
  const ctx = {
    automationName: "lead-generator",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  const input = inputSchema.parse(rawInput);
  const leads: Lead[] = [];

  try {
    // 1. Parallel search
    const tasks: Promise<void>[] = [];

    if (input.use_maps) {
      tasks.push((async () => {
        const mapsResults = await googleMapsSearchTool({
          query: input.query
        });
        mapsResults.forEach(p => {
          leads.push({
            name: p.name,
            website: p.website,
            phone: p.phone,
            source: "google_maps"
          });
        });
      })());
    }

    if (input.use_serper) {
      tasks.push((async () => {
        const serperResults = await serperSearchTool({
          query: input.query,
          limit: input.limit
        });
        serperResults.forEach(s => {
          leads.push({
            name: s.title,
            website: s.link,
            source: "serper"
          });
        });
      })());
    }

    await Promise.all(tasks);

    // Remove duplicates by website
    const uniqueLeads = Array.from(new Map(
        leads.filter(l => !!l.website).map(l => [l.website, l])
    ).values());

    const result: AutomationResult<Output> = {
      success: true,
      data: {
        leads: uniqueLeads,
        count: uniqueLeads.length
      },
      durationMs: Date.now() - ctx.startTime,
    };

    await logRun(ctx, result, input);
    return result;
  } catch (error: any) {
    const result: AutomationResult<Output> = {
      success: false,
      error: error.message,
      durationMs: Date.now() - ctx.startTime,
    };
    await logRun(ctx, result, input);
    throw error;
  }
}
