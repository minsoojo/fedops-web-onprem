import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const configUrl = new URL('../src/config/serverManager.js', import.meta.url).href;

function probe(contents, variables = {}, startup = false) {
  const directory = mkdtempSync(join(tmpdir(), 'fedops-config-'));
  const file = join(directory, 'settings.env');
  writeFileSync(file, contents);
  const env = { ...process.env };
  delete env.FL_SERVER_MANAGER_URL;
  delete env.SERVER_MANAGER_URL;
  delete env.DOTENV_CONFIG_PATH;
  delete env.NODE_TEST_CONTEXT;
  Object.assign(env, variables, { DOTENV_CONFIG_PATH: file });
  const code = startup
    ? `await import(${JSON.stringify(new URL('../src/index.js', import.meta.url).href)});`
    : `const { serverManagerUrl } = await import(${JSON.stringify(configUrl)}); console.log(serverManagerUrl);`;
  try {
    return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
      cwd: directory, env, encoding: 'utf8', timeout: 10000,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('external file is loaded before configuration evaluation, regardless of working directory', () => {
  const result = probe('FL_SERVER_MANAGER_URL=http://localhost:8000/prefix/\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'http://localhost:8000/prefix');
});

test('injected env overrides the same key in a file; legacy-only input still works', () => {
  const result = probe('FL_SERVER_MANAGER_URL=http://localhost:8000\n', {
    FL_SERVER_MANAGER_URL: 'http://127.0.0.1:8001',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'http://127.0.0.1:8001');
  const legacy = probe('SERVER_MANAGER_URL=https://example.invalid/\n');
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(legacy.stdout.trim(), 'https://example.invalid');
});

test('matching aliases normalize and conflicting aliases fail without echoing values', () => {
  assert.equal(probe('FL_SERVER_MANAGER_URL=http://LOCALHOST:80/\nSERVER_MANAGER_URL=http://localhost\n').status, 0);
  const conflict = probe('FL_SERVER_MANAGER_URL=http://first.invalid\nSERVER_MANAGER_URL=http://second.invalid\n');
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /must refer to the same base URL/);
  assert.doesNotMatch(conflict.stderr, /first\.invalid|second\.invalid/);
});

test('missing or invalid settings fail before application startup and do not leak credentials', () => {
  const missing = probe('', {}, true);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /FL_SERVER_MANAGER_URL is required/);
  for (const value of ['not-a-url', 'ftp://localhost', 'http://user:do-not-print@localhost',
    'http://localhost?token=do-not-print', 'http://localhost/#do-not-print']) {
    const result = probe(`FL_SERVER_MANAGER_URL="${value}"\n`);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be an HTTP\(S\) base URL/);
    assert.doesNotMatch(result.stderr, /do-not-print/);
  }
});
