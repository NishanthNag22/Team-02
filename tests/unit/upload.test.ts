import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readUpload } from '../../src/lib/services/upload';

/** Upload checks shared by vault and receipts (SR-07): missing file 422, too large 413, wrong content 415. */
const form = (bytes: Uint8Array<ArrayBuffer> | string, name = 'f.bin') => {
  const f = new FormData();
  f.append('file', new Blob([bytes]), name);
  return f;
};
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('accepts an allowed type and reports its detected type', async () => {
  const r = await readUpload(form(png, 'photo.png'), 1024, ['image/png', 'image/jpeg'], 'PNG or JPEG');
  assert.deepEqual([r.name, r.type, r.bytes.length], ['photo.png', 'image/png', 8]);
});

test('missing or empty file → 422', async () => {
  await assert.rejects(readUpload(new FormData(), 1024, ['image/png'], 'PNG'), { status: 422 });
  await assert.rejects(readUpload(null, 1024, ['image/png'], 'PNG'), { status: 422 });
  await assert.rejects(readUpload(form(new Uint8Array(0)), 1024, ['image/png'], 'PNG'), { status: 422 });
});

test('too large → 413 before the content is inspected', async () => {
  await assert.rejects(readUpload(form(new Uint8Array(2048)), 1024, ['image/png'], 'PNG'), { status: 413 });
});

test('content not in the allow-list → 415, even with an allowed-looking name', async () => {
  await assert.rejects(readUpload(form('<html>', 'photo.png'), 1024, ['image/png'], 'PNG'), { status: 415, message: 'Only PNG files are allowed.' });
  await assert.rejects(readUpload(form(png, 'photo.png'), 1024, ['application/pdf'], 'PDF'), { status: 415 });
});
