import { z } from 'zod';

export const simulateSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0').max(9_999_999_999_999),
});

export const prepaySchema = simulateSchema.extend({
  mode: z.enum(['reduce_tenure', 'reduce_emi']),
  fundingAssetId: z.coerce.number().int().positive().optional().nullable(),
});

export type PrepayInput = z.infer<typeof prepaySchema>;
