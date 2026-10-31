import { z } from 'zod';
import { LOAN_TYPES } from './loans';

export const recommendSchema = z.object({
  loanType: z.enum(LOAN_TYPES),
  amount: z.coerce.number().positive('Amount must be greater than 0').max(9_999_999_999_999),
  tenureMonths: z.coerce.number().int().min(1).max(480),
});
export type RecommendInput = z.infer<typeof recommendSchema>;
