import { z } from 'zod';

export const MAX_CSV_BYTES = 5 * 1024 * 1024;

export const importRowSchema = z.object({
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().trim().min(1).max(500),
  amount: z.number().positive().max(9_999_999_999_999),
  txnType: z.enum(['income', 'expense']),
  category: z.string().trim().min(1).max(60),
});

export const importCommitSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  bank: z.string().trim().min(1).max(20),
  rows: z.array(importRowSchema).min(1, 'Nothing to import').max(5000),
});

export type ImportCommit = z.infer<typeof importCommitSchema>;
