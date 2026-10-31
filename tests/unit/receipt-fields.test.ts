import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractReceiptFields } from '../../src/lib/services/receipt-fields';

const APOLLO = `APOLLO PHARMACY
Koramangala, Bengaluru
GSTIN: 29ABCDE1234F1Z5
Date: 12/10/2026
Paracetamol 650 45.00
Vitamin C 210.00
Cough Syrup 180.00
Sub Total 435.00
GST 20.28
Grand Total 455.28
Thank you, visit again`;

test('pharmacy receipt: merchant, grand total (not sub total) and date', () => {
  assert.deepEqual(extractReceiptFields(APOLLO), { merchant: 'APOLLO PHARMACY', amount: 455.28, date: '2026-10-12' });
});

test('skips "TAX INVOICE" header and reads Net Amount with ₹ and Indian commas', () => {
  const r = extractReceiptFields(`TAX INVOICE\nRELIANCE SMART\nBill No 88123   Date 05-Oct-2026\nItems 12\nNet Amount ₹ 1,24,560.50\n`);
  assert.equal(r.merchant, 'RELIANCE SMART');
  assert.equal(r.amount, 124560.5);
  assert.equal(r.date, '2026-10-05');
});

test('no total label: falls back to the largest amount', () => {
  const r = extractReceiptFields('Chai Point\n2 x Chai 40.00\n1 x Samosa 25.00\n');
  assert.equal(r.amount, 40);
});

test('unreadable text gives nulls instead of guesses', () => {
  assert.deepEqual(extractReceiptFields('~~ ## ..'), { merchant: null, amount: null, date: null });
});