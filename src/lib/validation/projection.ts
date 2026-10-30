import { z } from 'zod';

export const projectionQuerySchema = z.object({
  months: z.coerce.number().int().min(6).max(360).default(60),
  growthPct: z.coerce.number().min(0).max(30).default(8),
  monthlySurplus: z.coerce.number().min(-10_000_000).max(10_000_000).optional(),
  closeLoanId: z.coerce.number().int().positive().optional(),
});
export type ProjectionQuery = z.infer<typeof projectionQuerySchema>;
