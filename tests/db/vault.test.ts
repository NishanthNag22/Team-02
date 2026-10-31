import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDocument, deleteDocument, getStoredFile, listDocuments } from '../../src/lib/db/documents';
import { createLoan } from '../../src/lib/db/loans';
import { loadFile } from '../../src/lib/services/file-store';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
before(async () => { process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), 'ww-vault-db-')); });
after(() => cleanup(users));

const pdf = { name: 'sanction-letter.pdf', bytes: new TextEncoder().encode('%PDF-1.4 sanction'), type: 'application/pdf' as const };

test('upload, find by tag and text, then delete (FR-17)', async () => {
  const u = await createTestUser();
  users.push(u);
  const loan = await createLoan(u, { loanType: 'home', lender: 'SBI', principal: 1000000, interestRate: 8.5, interestType: 'floating', tenureMonths: 120, startDate: '2026-01-01' });
  const doc = await createDocument(u, { title: 'SBI sanction letter', tags: ['loan papers', 'sbi'], loanId: loan.id }, pdf);

  assert.equal((await listDocuments(u, { tag: 'sbi' })).documents.length, 1);
  assert.equal((await listDocuments(u, { q: 'sanction' })).documents.length, 1);
  assert.equal((await listDocuments(u, { loanId: loan.id })).stats.count, 1);
  assert.equal((await listDocuments(u, { tag: 'insurance' })).documents.length, 0);

  const stored = await getStoredFile(u, doc.id);
  assert.equal((await loadFile(stored!.storedName)).toString(), '%PDF-1.4 sanction');

  assert.equal(await deleteDocument(u, doc.id), true);
  assert.equal((await listDocuments(u, {})).stats.count, 0);
  await assert.rejects(loadFile(stored!.storedName), { status: 404 });
});

test("another user can't see, download, delete or link to my things", async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  const loan = await createLoan(a, { loanType: 'personal', lender: 'HDFC', principal: 100000, interestRate: 12, interestType: 'fixed', tenureMonths: 12, startDate: '2026-01-01' });
  const doc = await createDocument(a, { title: 'Mine', tags: [] }, pdf);

  assert.equal((await listDocuments(b, {})).stats.count, 0);
  assert.equal(await getStoredFile(b, doc.id), null);
  assert.equal(await deleteDocument(b, doc.id), false);
  await assert.rejects(createDocument(b, { title: 'x', tags: [], loanId: loan.id }, pdf), { status: 422 });
});

test('vault reports unavailable (503) when storage cannot be written (NFR-04)', async () => {
  const u = await createTestUser();
  users.push(u);
  const saved = process.env.UPLOAD_DIR;
  // a path *inside a file* can never be created as a folder
  const blocker = path.join(saved!, 'blocker.txt');
  await writeFile(blocker, 'x');
  process.env.UPLOAD_DIR = path.join(blocker, 'uploads');
  await assert.rejects(createDocument(u, { title: 'x', tags: [] }, pdf), { status: 503 });
  process.env.UPLOAD_DIR = saved;
});