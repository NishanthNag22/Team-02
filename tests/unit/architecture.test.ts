import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * NFR-06: layering rules, checked on every push.
 *   UI (pages, components)  → never imports the database layer
 *   API route handlers      → no inline SQL, no direct pg / pool access, errors go through apiError()
 */
const ROOT = path.join(__dirname, '../../src');

function files(dir: string, match: (f: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p, match) : match(p) ? [p] : [];
  });
}
const rel = (p: string) => path.relative(ROOT, p);

const uiFiles = [
  ...files(path.join(ROOT, 'app'), (f) => /\.tsx$/.test(f) && !f.includes(`${path.sep}api${path.sep}`)),
  ...files(path.join(ROOT, 'components'), (f) => /\.tsx?$/.test(f)),
];
const routeFiles = files(path.join(ROOT, 'app', 'api'), (f) => f.endsWith('route.ts'));

test('there is something to check', () => {
  assert.ok(uiFiles.length > 10);
  assert.ok(routeFiles.length > 20);
});

test('UI files never import the database layer', () => {
  const bad = uiFiles.filter((f) => {
    const src = readFileSync(f, 'utf8');
    // the (app) layout may read the session cookie, which is auth, not database access
    return /from ['"](@\/lib\/db\/|pg['"])/.test(src);
  });
  assert.deepEqual(bad.map(rel), []);
});

test('route handlers contain no inline SQL and do not touch pg directly', () => {
  const SQL = /\b(SELECT\s+[\w*]|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/;
  const bad = routeFiles.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return SQL.test(src) || /from ['"](pg|@\/lib\/db\/postgres)['"]/.test(src);
  });
  assert.deepEqual(bad.map(rel), []);
});

// /api/health deliberately answers 503 with its own body so monitoring tools can read it.
const OWN_ERROR_FORMAT = new Set([path.join('app', 'api', 'health', 'route.ts')]);

test('every route handler sends errors through apiError()', () => {
  const bad = routeFiles.filter((f) => {
    if (OWN_ERROR_FORMAT.has(rel(f))) return false;
    const src = readFileSync(f, 'utf8');
    return /export async function (GET|POST|PUT|PATCH|DELETE)/.test(src) && /try\s*{/.test(src) && !src.includes('apiError(');
  });
  assert.deepEqual(bad.map(rel), []);
});

test('only the data-access layer imports pg', () => {
  const all = files(ROOT, (f) => /\.tsx?$/.test(f));
  const bad = all.filter((f) => /from ['"]pg['"]/.test(readFileSync(f, 'utf8')) && !f.includes(`${path.sep}lib${path.sep}db${path.sep}`));
  assert.deepEqual(bad.map(rel), []);
});
