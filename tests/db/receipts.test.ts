import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { confirmReceipt } from '../../src/lib/db/receipts';
import { listDocuments } from '../../src/lib/db/documents';
import { scanReceipt } from '../../src/lib/services/ocr';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
before(async () => { process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), 'ww-receipts-')); });
after(() => cleanup(users));

test('OCR reads the sample receipt (FR-16, NFR-01: under 10 s)', async () => {
  const t = performance.now();
  const r = await scanReceipt(await readFile(path.join(__dirname, '../fixtures/receipt.png')));
  assert.ok(performance.now() - t < 10000);
  assert.equal(r.merchant, 'APOLLO PHARMACY');
  assert.equal(r.amount, 455.28);
  assert.equal(r.date, '2026-10-12');
});

test('confirm saves an expense, files the image, and refuses the same receipt again', async () => {
  const u = await createTestUser();
  users.push(u);
  const bytes = new Uint8Array(await readFile(path.join(__dirname, '../fixtures/receipt.png')));
  const input = { merchant: 'APOLLO PHARMACY', amount: 455.28, date: '2026-10-12', category: 'Health', saveToVault: true };

  const first = await confirmReceipt(u, input, { name: 'receipt.png', bytes, type: 'image/png' });
  assert.ok(first.transactionId > 0);
  assert.equal(first.vault.saved, true);
  assert.equal((await listDocuments(u, { tag: 'receipt' })).stats.count, 1);

  await assert.rejects(confirmReceipt(u, { ...input, merchant: 'apollo pharmacy' }), { status: 409 });
});