import { z } from 'zod';

export const ruleSchema = z.object({
  keyword: z.string().trim().min(2, 'Keyword must be at least 2 characters').max(60),
  category: z.string().trim().min(1).max(80),
  txnType: z.enum(['income', 'expense', 'asset', 'loan']).default('expense'),
  priority: z.coerce.number().int().min(1).max(999).optional(),
});
