import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { clientDetail, getMyAdvisor, listClients, setMyAdvisor } from '../../src/lib/db/advisor';
import { createAsset } from '../../src/lib/db/assets';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

const emailOf = async (id: number) => String((await query('SELECT email FROM users WHERE id = $1', [id]))[0].email);

test('advisor sees only assigned clients; other users are 403 (AC-26)', async () => {
  const advisor = await createTestUser('advisor');
  const client = await createTestUser();
  const stranger = await createTestUser();
  users.push(advisor, client, stranger);
  await createAsset(client, { name: 'PPF', assetType: 'ppf', liquidity: 'illiquid', purchaseValue: 300000, currentValue: 350000, purchaseDate: '2020-04-01', valuationDate: '2026-10-01' });

  await setMyAdvisor(client, await emailOf(advisor));
  assert.equal((await getMyAdvisor(client))?.id, advisor);

  const list = await listClients(advisor);
  assert.deepEqual(list.map((c) => c.id), [client]);
  assert.equal(list[0].netWorth, 350000);

  const d = await clientDetail(advisor, client);
  assert.equal(d.assets.length, 1);
  await assert.rejects(clientDetail(advisor, stranger), { status: 403 });
});

test('only advisor accounts can be chosen', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  await assert.rejects(setMyAdvisor(a, await emailOf(b)), { status: 404 });
  await assert.rejects(setMyAdvisor(a, 'nobody@example.com'), { status: 404 });
});
