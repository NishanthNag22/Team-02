import { z } from 'zod';

export const receiptConfirmSchema = z.object({
  merchant: z.string().trim().min(1, 'Merchant is required').max(100),
  amount: z.coerce.number().positive('Amount must be greater than 0').max(9_999_999_999_999),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  category: z.string().trim().min(1).max(60).default('Shopping'),
  saveToVault: z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean()).default(false),
});
export type ReceiptConfirm = z.infer<typeof receiptConfirmSchema>;