import PDFDocument from 'pdfkit';

/**
 * Net worth statement PDF (FR-23). Uses the built-in Helvetica font, which has no ₹ glyph,
 * so amounts are written as "Rs. 1,65,000.00". The PAN is always masked (SR-09).
 */

export interface StatementData {
  name: string;
  email: string;
  pan: string | null;
  generatedOn: string;
  summary: { totalAssets: number; totalLiabilities: number; netWorth: number; liquidAssets: number };
  assets: { name: string; assetType: string; currentValue: number; valuationDate: string }[];
  loans: { lender: string; loanType: string; interestRate: number; emiAmount: number; outstanding: number }[];
  netWorthByMonth: { month: string; netWorth: number }[];
  fyToDate: { label: string; from: string; to: string; income: number; expense: number; net: number };
}

/** "ABCDE1234F" -> "XXXXXX234F": only the last four characters stay visible. */
export function maskPan(pan: string | null): string {
  if (!pan) return 'Not provided';
  return `${'X'.repeat(Math.max(0, pan.length - 4))}${pan.slice(-4)}`;
}

export const rs = (n: number) => `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const SHORT: Record<string, string> = { fd: 'FD', epf: 'EPF', ppf: 'PPF' };
const label = (s: string) => SHORT[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function buildStatement(d: StatementData, opts: { compress?: boolean } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, compress: opts.compress ?? true, info: { Title: 'WealthWise net worth statement', Author: 'WealthWise' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;
    const heading = (t: string) => { doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor('#7a4a12').text(t).fillColor('black').moveDown(0.3); };
    const row = (cols: string[], widths: number[], bold = false) => {
      const y = doc.y;
      if (y > doc.page.height - 80) doc.addPage();
      const top = doc.y;
      let x = 50;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      cols.forEach((c, i) => { doc.text(c, x, top, { width: widths[i] * W - 4, align: i === 0 ? 'left' : 'right' }); x += widths[i] * W; });
      doc.x = 50;
      doc.y = top + 14;
    };

    doc.font('Helvetica-Bold').fontSize(18).text('WealthWise – Net Worth Statement');
    doc.font('Helvetica').fontSize(10).fillColor('#555')
      .text(`${d.name} · ${d.email}`)
      .text(`PAN: ${maskPan(d.pan)} · Generated on ${d.generatedOn}`).fillColor('black');

    heading('Summary');
    const s = d.summary;
    row(['Total assets', rs(s.totalAssets)], [0.6, 0.4]);
    row(['of which liquid', rs(s.liquidAssets)], [0.6, 0.4]);
    row(['Total liabilities', rs(s.totalLiabilities)], [0.6, 0.4]);
    row(['Net worth', rs(s.netWorth)], [0.6, 0.4], true);

    heading('Assets');
    row(['Asset', 'Type', 'Valued on', 'Current value'], [0.4, 0.2, 0.15, 0.25], true);
    d.assets.forEach((a) => row([a.name, label(a.assetType), a.valuationDate, rs(a.currentValue)], [0.4, 0.2, 0.15, 0.25]));
    if (!d.assets.length) row(['No assets recorded'], [1]);

    heading('Active liabilities');
    row(['Lender', 'Type', 'Rate', 'EMI', 'Outstanding'], [0.3, 0.15, 0.1, 0.2, 0.25], true);
    d.loans.forEach((l) => row([l.lender, label(l.loanType), `${l.interestRate}%`, rs(l.emiAmount), rs(l.outstanding)], [0.3, 0.15, 0.1, 0.2, 0.25]));
    if (!d.loans.length) row(['No active loans'], [1]);

    heading('Net worth – last 12 months');
    row(['Month', 'Net worth'], [0.6, 0.4], true);
    d.netWorthByMonth.forEach((m) => row([m.month, rs(m.netWorth)], [0.6, 0.4]));
    if (!d.netWorthByMonth.length) row(['No history yet'], [1]);

    heading(`${d.fyToDate.label} to date (${d.fyToDate.from} to ${d.fyToDate.to})`);
    row(['Income', rs(d.fyToDate.income)], [0.6, 0.4]);
    row(['Expenses', rs(d.fyToDate.expense)], [0.6, 0.4]);
    row(['Net saving', rs(d.fyToDate.net)], [0.6, 0.4], true);

    doc.moveDown(2).font('Helvetica').fontSize(8).fillColor('#777')
      .text('Values are as recorded by the user in WealthWise. This statement is for personal reference and is not a bank or audited document.', 50, doc.y, { width: W });
    doc.end();
  });
}
