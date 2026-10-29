import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { listNotifications, markAllRead, markRead } from '../../src/lib/db/notifications';
import { createLoan } from '../../src/lib/db/loans';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

/** A loan started 3 months ago: 2 installments overdue, 1 due within days. */
function startDate(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 3);
  d.setUTCDate(Math.min(d.getUTCDate() + 3, 28));
  return d.toISOString().slice(0, 10);
}

test('reminders are created once per installment and kind (AC-24)', async () => {
  const u = await createTestUser();
  users.push(u);
  await createLoan(u, { loanType: 'personal', lender: 'Axis', principal: 200000, interestRate: 12, interestType: 'fixed', tenureMonths: 24, startDate: startDate() });

  const first = await listNotifications(u);
  const second = await listNotifications(u);
  assert.ok(first.notifications.some((n) => n.kind === 'overdue'));
  assert.equal(second.notifications.length, first.notifications.length);
  assert.equal(second.unread, first.unread);
  assert.match(first.notifications[0].body, /Rs\. [\d,]+\.\d\d/);
});

test('mark one read lowers unread by one; mark all sets it to 0', async () => {
  const u = await createTestUser();
  const other = await createTestUser();
  users.push(u, other);
  await createLoan(u, { loanType: 'personal', lender: 'Axis', principal: 200000, interestRate: 12, interestType: 'fixed', tenureMonths: 24, startDate: startDate() });

  const before = await listNotifications(u);
  assert.ok(before.unread >= 2);
  assert.equal(await markRead(other, before.notifications[0].id), 0); // not mine
  assert.equal(await markRead(u, before.notifications[0].id), 1);
  assert.equal((await listNotifications(u)).unread, before.unread - 1);
  await markAllRead(u);
  assert.equal((await listNotifications(u)).unread, 0);
});
