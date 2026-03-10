import { z } from "zod";

// Definuj vstupné dáta pre túto automatizáciu
export const inputSchema = z.object({
  // Príklad:
  // userId: z.string().uuid(),
  // message: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = {
  // Definuj výstup
};
