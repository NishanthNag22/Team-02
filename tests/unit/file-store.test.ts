import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectType, loadFile, removeFile, saveFile } from '../../src/lib/services/file-store';

const bytes = (...b: number[]) => new Uint8Array(b);

test('detects allowed types from the first bytes', () => {
  assert.equal(detectType(new TextEncoder().encode('%PDF-1.7 ...')), 'application/pdf');
  assert.equal(detectType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(detectType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a)), 'image/png');
  assert.equal(detectType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
});

test('rejects GIF, executables and text even if renamed', () => {
  assert.equal(detectType(new TextEncoder().encode('GIF89a')), null);
  assert.equal(detectType(bytes(0x4d, 0x5a, 0x90, 0x00)), null); // .exe
  assert.equal(detectType(new TextEncoder().encode('<html>')), null);
});

test('saves under a random name and refuses path tricks', async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), 'ww-vault-'));
  const name = await saveFile(new TextEncoder().encode('%PDF-1.4 test'), 'application/pdf');
  assert.match(name, /^[0-9a-f-]{36}\.pdf$/);
  assert.equal((await loadFile(name)).toString(), '%PDF-1.4 test');
  await assert.rejects(loadFile('../../etc/passwd'), { status: 404 });
  await removeFile(name);
  await assert.rejects(loadFile(name), { status: 404 });
});