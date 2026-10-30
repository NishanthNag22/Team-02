import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importHash, parseAmount, parseDate, parseStatement, readCsv } from '../../src/lib/services/csv-parser';

const HDFC = `HDFC BANK Ltd.
Account No : 50100012345678
Statement From : 01/10/2026 To : 31/10/2026
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/10/26,SALARY OCT ACME TECH,,01/10/26,,"1,65,000.00","2,10,000.00"
03/10/26,"UPI/SWIGGY/ORDER, DINNER",,03/10/26,455.28,,"2,09,544.72"
05/10/26,BESCOM ELECTRICITY,,05/10/26,"1,240.00",,"2,08,304.72"
31/02/26,BAD DATE ROW,,31/02/26,100.00,,0
07/10/26,,,07/10/26,50.00,,0
`;

const ICICI = `Transaction Date,Transaction Remarks,Debit,Credit,Balance
2026-10-02,AMAZON PAY INDIA,1299.00,,5000.00
2026-10-04,INTEREST CREDIT,,312.50,5312.50
`;

test('reads quoted fields with commas inside', () => {
  assert.deepEqual(readCsv('a,"b, c",d\n'), [['a', 'b, c', 'd']]);
});

test('parses day-first dates and rejects impossible ones', () => {
  assert.equal(parseDate('05/03/26'), '2026-03-05');
  assert.equal(parseDate('2026-10-02'), '2026-10-02');
  assert.equal(parseDate('12 Oct 2026'), '2026-10-12');
  assert.equal(parseDate('31/02/26'), null);
});

test('parses Indian digit grouping', () => {
  assert.equal(parseAmount('"1,65,000.00"'.replace(/"/g, '')), 165000);
  assert.equal(parseAmount(''), null);
});

test('HDFC layout: skips preamble, finds columns by name, rejects bad rows with reasons', () => {
  const s = parseStatement('hdfc_oct.csv', HDFC);
  assert.equal(s.bank, 'HDFC');
  assert.equal(s.rows.length, 3);
  assert.deepEqual(s.rows[0], { ...s.rows[0], txnDate: '2026-10-01', amount: 165000, txnType: 'income' });
  assert.equal(s.rows[1].description, 'UPI/SWIGGY/ORDER, DINNER');
  assert.equal(s.rows[1].txnType, 'expense');
  assert.deepEqual(s.rejected.map((r) => r.reason), ['Invalid date "31/02/26"', 'Missing description']);
});

test('ICICI layout with Debit/Credit columns and ISO dates', () => {
  const s = parseStatement('statement.csv', ICICI);
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[1].txnType, 'income');
  assert.equal(s.rows[1].amount, 312.5);
});

test('the same row always gives the same 32-character hash', () => {
  const h = importHash('2026-10-01', 455.28, 'expense', 'upi/swiggy  order');
  assert.equal(h, importHash('2026-10-01', 455.28, 'expense', 'UPI/SWIGGY ORDER'));
  assert.match(h, /^[a-f0-9]{32}$/);
});

test('a file without a recognisable header is refused', () => {
  assert.throws(() => parseStatement('x.csv', 'foo,bar\n1,2\n'), /Could not find a header row/);
});
