import { calculateEmi } from './emi';

/**
 * Loan product comparison (FR-20). Pure function.
 * Each product's rate is placed between its min and max by the user's score:
 * score 900 gets min_rate, score = min_score gets max_rate (linear in between).
 * Eligible products are ranked by total cost (interest + processing fee), cheapest first.
 */

export interface Product {
  id: number; lender: string; productName: string; loanType: string;
  minRate: number; maxRate: number; minScore: number; minAmount: number; maxAmount: number;
  maxTenureMonths: number; processingFeePct: number;
}

export interface Offer {
  productId: number; lender: string; productName: string;
  eligible: boolean; reasons: string[];
  rate: number | null; emi: number | null; totalInterest: number | null; processingFee: number | null; totalCost: number | null;
  rank: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function priceFor(p: Product, score: number): number {
  const t = Math.min(1, Math.max(0, (score - p.minScore) / (900 - p.minScore || 1)));
  return r2(p.maxRate - (p.maxRate - p.minRate) * t);
}

export function compareProducts(products: Product[], score: number, amount: number, tenureMonths: number): Offer[] {
  const offers: Offer[] = products.map((p) => {
    const reasons: string[] = [];
    if (score < p.minScore) reasons.push(`Needs a score of at least ${p.minScore} (yours is ${score})`);
    if (amount < p.minAmount) reasons.push(`Minimum amount is ₹${p.minAmount.toLocaleString('en-IN')}`);
    if (amount > p.maxAmount) reasons.push(`Maximum amount is ₹${p.maxAmount.toLocaleString('en-IN')}`);
    if (tenureMonths > p.maxTenureMonths) reasons.push(`Maximum tenure is ${p.maxTenureMonths} months`);
    const base = { productId: p.id, lender: p.lender, productName: p.productName, reasons, rank: null };
    if (reasons.length) return { ...base, eligible: false, rate: null, emi: null, totalInterest: null, processingFee: null, totalCost: null };

    const rate = priceFor(p, score);
    const emi = calculateEmi(amount, rate, tenureMonths);
    const totalInterest = r2(emi * tenureMonths - amount);
    const processingFee = r2((amount * p.processingFeePct) / 100);
    return { ...base, eligible: true, rate, emi, totalInterest, processingFee, totalCost: r2(totalInterest + processingFee) };
  });

  const eligible = offers.filter((o) => o.eligible).sort((a, b) => a.totalCost! - b.totalCost!);
  eligible.forEach((o, i) => { o.rank = i + 1; });
  return [...eligible, ...offers.filter((o) => !o.eligible)];
}
