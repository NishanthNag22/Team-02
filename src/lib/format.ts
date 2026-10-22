/**
 * Formats a rupee amount with Indian digit grouping, e.g. 9200000 -> "₹92,00,000.00" (SRS NFR-05).
 */
export function formatINR(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
