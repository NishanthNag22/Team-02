import { z } from 'zod';

export const TXN_TYPES = ['income', 'expense', 'asset', 'loan'] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const transactionSchema = z.object({
  txnType: z.enum(TXN_TYPES),
  amount: z.coerce.number().positive('Amount must be greater than 0').max(9_999_999_999_999).finite(),
  txnDate: isoDate,
  category: z.string().trim().min(1).max(80).default('Uncategorized'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  relatedAssetId: z.coerce.number().int().positive().optional().nullable(),
  relatedLoanId: z.coerce.number().int().positive().optional().nullable(),
});

export const transactionFilterSchema = z.object({
  type: z.enum(TXN_TYPES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
