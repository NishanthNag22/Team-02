import { z } from 'zod';

export const MAX_VAULT_BYTES = 10 * 1024 * 1024;

const optionalId = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().positive().optional());

/** "Loan papers, SBI , 2026" -> ["loan papers", "sbi", "2026"] (max 10 tags, 30 chars each). */
const tags = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : []),
  z.array(z.string().max(30, 'Each tag can be at most 30 characters')).max(10, 'At most 10 tags'),
);

export const documentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  tags,
  loanId: optionalId,
  assetId: optionalId,
});

export const vaultFilterSchema = z.object({
  tag: z.string().trim().toLowerCase().max(30).optional(),
  q: z.string().trim().max(100).optional(),
  loanId: optionalId,
  assetId: optionalId,
});

export type DocumentInput = z.infer<typeof documentSchema>;
export type VaultFilter = z.infer<typeof vaultFilterSchema>;