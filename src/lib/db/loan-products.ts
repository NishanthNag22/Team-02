import { query } from './postgres';
import { currentScore } from './credit-score';
import { compareProducts, type Product } from '@/lib/services/recommend';
import type { RecommendInput } from '@/lib/validation/recommend';

export async function productsOfType(loanType: string): Promise<Product[]> {
  const rows = await query(
    `SELECT id, lender, product_name, loan_type, min_rate, max_rate, min_score, min_amount, max_amount,
            max_tenure_months, processing_fee_pct
       FROM loan_products WHERE loan_type = $1 ORDER BY lender, product_name`,
    [loanType],
  );
  return rows.map((r) => ({
    id: Number(r.id), lender: String(r.lender), productName: String(r.product_name), loanType: String(r.loan_type),
    minRate: Number(r.min_rate), maxRate: Number(r.max_rate), minScore: Number(r.min_score),
    minAmount: Number(r.min_amount), maxAmount: Number(r.max_amount), maxTenureMonths: Number(r.max_tenure_months),
    processingFeePct: Number(r.processing_fee_pct),
  }));
}

/** Prices the catalogue for my current derived score (FR-20). Illustrative only – not an offer or advice. */
export async function recommend(userId: number, input: RecommendInput) {
  const [{ score }, products] = await Promise.all([currentScore(userId), productsOfType(input.loanType)]);
  return {
    score,
    request: input,
    offers: compareProducts(products, score, input.amount, input.tenureMonths),
    note: 'Sample products and rates for comparison only. Not a loan offer or financial advice.',
  };
}
