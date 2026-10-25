import { z } from 'zod';

export const LOAN_TYPES = ['home', 'vehicle', 'personal', 'education', 'gold', 'business', 'credit_card'] as const;

export const loanSchema = z.object({
  loanType: z.enum(LOAN_TYPES),
  lender: z.string().trim().min(1).max(160),
  principal: z.coerce.number().positive('Principal must be greater than 0').max(9_999_999_999_999),
  interestRate: z.coerce.number().gt(0, 'Rate must be greater than 0').max(60, 'Rate cannot exceed 60%'),
  interestType: z.enum(['fixed', 'floating']).default('fixed'),
  tenureMonths: z.coerce.number().int().min(1, 'At least 1 month').max(480, 'At most 480 months'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

export type LoanInput = z.infer<typeof loanSchema>;
