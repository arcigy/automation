export interface AutomationContext {
  automationName: string;
  runId: string;
  startTime: number;
}

export interface AutomationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

export type Handler<TInput, TOutput> = (
  input: TInput,
  ctx: AutomationContext,
) => Promise<AutomationResult<TOutput>>;
