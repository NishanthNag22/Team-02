import { z } from 'zod';

export const ASSET_TYPES = ['gold', 'property', 'equity', 'mutual_fund', 'epf', 'ppf', 'fd', 'vehicle', 'cash', 'other'] as const;

/** Default liquidity per asset type; the user can override it. */
export const DEFAULT_LIQUIDITY: Record<(typeof ASSET_TYPES)[number], 'liquid' | 'illiquid'> = {
  cash: 'liquid', fd: 'liquid', equity: 'liquid', mutual_fund: 'liquid', gold: 'liquid',
  property: 'illiquid', epf: 'illiquid', ppf: 'illiquid', vehicle: 'illiquid', other: 'illiquid',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const amount = z.coerce.number().min(0, 'Must be 0 or more').max(9_999_999_999_999).finite();

export const assetSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    assetType: z.enum(ASSET_TYPES),
    liquidity: z.enum(['liquid', 'illiquid']).optional(),
    purchaseValue: amount,
    currentValue: amount,
    purchaseDate: isoDate,
    valuationDate: isoDate.optional().or(z.literal('').transform(() => undefined)),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((v) => !v.valuationDate || v.valuationDate >= v.purchaseDate, {
    message: 'Valuation date cannot be before the purchase date',
    path: ['valuationDate'],
  });

export type AssetInput = z.infer<typeof assetSchema>;
