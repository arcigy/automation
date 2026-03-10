import { sql } from "./db";
import type { AutomationContext, AutomationResult } from "./types";

export async function logRun(
  ctx: AutomationContext,
  result: AutomationResult,
  payload: unknown,
): Promise<void> {
  try {
    await sql`
      INSERT INTO automation_logs (
        automation_name,
        run_id,
        status,
        payload,
        result,
        error,
        duration_ms,
        created_at
      ) VALUES (
        ${ctx.automationName},
        ${ctx.runId},
        ${result.success ? "success" : "error"},
        ${payload ? sql.json(payload as any) : null},
        ${result.data ? sql.json(result.data as any) : null},
        ${result.error ?? null},
        ${result.durationMs},
        now()
      )
    `;
  } catch (e: any) {
    console.error("Local DB logging skipped / failed:", e.message);
  }
}
