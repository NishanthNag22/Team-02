/**
 * Demo data for presentations: `npm run db:seed`.
 * Re-running it deletes and recreates the three demo accounts (everything else is untouched).
 */
import 'dotenv/config';
import { getPool, query } from '../src/lib/db/postgres';
import { hashPassword } from '../src/lib/auth/password';
import { createAsset } from '../src/lib/db/assets';
import { createLoan, getSchedule, payInstallment } from '../src/lib/db/loans';
import { createTransaction } from '../src/lib/db/transactions';
import { addMonths } from '../src/lib/services/emi';

const DEMO = ['priya@wealthwise.dev', 'rahul@wealthwise.dev', 'advisor@wealthwise.dev'];
const today = new Date().toISOString().slice(0, 10);
const monthsAgo = (n: number, day = 5) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  d.setUTCDate(day);
  return d.toISOString().slice(0, 10);
};

async function user(name: string, email: string, role: 'individual' | 'advisor', pan: string | null) {
  const rows = await query<{ id: string }>(
    'INSERT INTO users (name, email, password_hash, role, pan_number) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name, email, await hashPassword('password123'), role, pan],
  );
  return Number(rows[0].id);
}

/** Pays every installment due before today, on its due date. */
async function payDue(userId: number, loanId: number, skipLast = false) {
  const due = (await getSchedule(userId, loanId)).filter((r) => r.dueDate < today);
  const toPay = skipLast ? due.slice(0, -1) : due;
  for (const r of toPay) {
    await payInstallment(userId, r.id);
    await query('UPDATE emi_schedule SET paid_date = due_date WHERE id = $1', [r.id]);
    await query("UPDATE transactions SET txn_date = $2 WHERE user_id = $1 AND description LIKE $3", [userId, r.dueDate, `EMI #${r.installmentNo} –%`]);
  }
}

async function ledger(userId: number, salary: number, rent: number) {
  for (let m = 11; m >= 0; m--) {
    const d = (day: number) => monthsAgo(m, day);
    if (d(1) > today) continue;
    await createTransaction(userId, { txnType: 'income', amount: salary, txnDate: d(1), category: 'Salary', description: 'SALARY ACME TECH PVT LTD' });
    const items: [number, string, string, number][] = [
      [2, 'Rent', 'RENT TRANSFER LANDLORD', rent],
      [4, 'Utilities', 'BESCOM ELECTRICITY BILL', 1100 + (m % 4) * 180],
      [6, 'Groceries', 'BIG BAZAAR KORAMANGALA', 5200 + (m % 3) * 650],
      [9, 'Food', 'UPI/SWIGGY/ORDER', 1450 + (m % 5) * 220],
      [12, 'Fuel', 'INDIAN OIL PETROL PUMP', 3000 + (m % 2) * 400],
      [15, 'Shopping', 'AMAZON PAY INDIA', 2400 + (m % 4) * 900],
      [20, 'Health', 'APOLLO PHARMACY', 600 + (m % 3) * 150],
      [24, 'Entertainment', 'NETFLIX SUBSCRIPTION', 649],
    ];
    for (const [day, category, description, amount] of items) {
      if (amount > 0 && d(day) <= today) await createTransaction(userId, { txnType: 'expense', amount, txnDate: d(day), category, description });
    }
  }
}

async function main() {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [DEMO]);

  const advisor = await user('Anita Rao (Advisor)', DEMO[2], 'advisor', null);
  const priya = await user('Priya Sharma', DEMO[0], 'individual', 'ABCPS1234K');
  const rahul = await user('Rahul Verma', DEMO[1], 'individual', 'BCDRV5678L');
  await query('UPDATE users SET advisor_id = $1 WHERE id = ANY($2::bigint[])', [advisor, [priya, rahul]]);

  // Priya – home owner with a mix of assets
  await createAsset(priya, { name: 'Flat in Whitefield', assetType: 'property', liquidity: 'illiquid', purchaseValue: 7200000, currentValue: 8400000, purchaseDate: '2023-06-15', valuationDate: today });
  await createAsset(priya, { name: 'Gold jewellery', assetType: 'gold', liquidity: 'liquid', purchaseValue: 450000, currentValue: 610000, purchaseDate: '2021-11-04', valuationDate: today });
  await createAsset(priya, { name: 'Nifty 50 index fund', assetType: 'mutual_fund', liquidity: 'liquid', purchaseValue: 600000, currentValue: 742000, purchaseDate: '2022-04-10', valuationDate: today });
  await createAsset(priya, { name: 'SBI fixed deposit', assetType: 'fd', liquidity: 'liquid', purchaseValue: 500000, currentValue: 500000, purchaseDate: '2025-04-01', valuationDate: today });
  await createAsset(priya, { name: 'EPF balance', assetType: 'epf', liquidity: 'illiquid', purchaseValue: 380000, currentValue: 455000, purchaseDate: '2019-07-01', valuationDate: today });
  const home = await createLoan(priya, { loanType: 'home', lender: 'SBI', principal: 5000000, interestRate: 8.5, interestType: 'floating', tenureMonths: 240, startDate: addMonths(monthsAgo(28, 10), 0) });
  await payDue(priya, home.id);
  const car = await createLoan(priya, { loanType: 'vehicle', lender: 'HDFC Bank', principal: 800000, interestRate: 9.2, interestType: 'fixed', tenureMonths: 60, startDate: monthsAgo(14, 7) });
  await payDue(priya, car.id);
  await ledger(priya, 165000, 0);

  // Rahul – renter with a personal loan and one overdue EMI
  await createAsset(rahul, { name: 'Savings account', assetType: 'cash', liquidity: 'liquid', purchaseValue: 210000, currentValue: 210000, purchaseDate: '2024-01-01', valuationDate: today });
  await createAsset(rahul, { name: 'PPF', assetType: 'ppf', liquidity: 'illiquid', purchaseValue: 300000, currentValue: 352000, purchaseDate: '2020-04-01', valuationDate: today });
  await createAsset(rahul, { name: 'Two-wheeler', assetType: 'vehicle', liquidity: 'illiquid', purchaseValue: 110000, currentValue: 70000, purchaseDate: '2022-08-20', valuationDate: today });
  const personal = await createLoan(rahul, { loanType: 'personal', lender: 'ICICI Bank', principal: 400000, interestRate: 13.5, interestType: 'fixed', tenureMonths: 36, startDate: monthsAgo(10, 3) });
  await payDue(rahul, personal.id, true);
  const edu = await createLoan(rahul, { loanType: 'education', lender: 'Bank of Baroda', principal: 600000, interestRate: 9.8, interestType: 'floating', tenureMonths: 84, startDate: monthsAgo(20, 15) });
  await payDue(rahul, edu.id);
  await ledger(rahul, 85000, 22000);

  console.log('Seeded demo accounts (password: password123):');
  for (const e of DEMO) console.log(`  ${e}`);
  await getPool().end();
}

main().catch(async (e) => {
  console.error(e);
  await getPool().end();
  process.exit(1);
});
