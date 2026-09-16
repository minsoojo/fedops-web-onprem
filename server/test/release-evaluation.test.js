import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { createReleaseEvaluationReader, parseReleaseEvaluation, supportsEvaluationOverride } from '../src/lib/releaseEvaluation.js';

const contract = { name: 'federated-task-v3', fedopsVersion: '1.1.30.18' };
const server = 'def main(): prepare_validation_loader(config, factory)';

test('Release config decides true/false; missing, interpolated or non-boolean values are not guessed', () => {
  for (const enabled of [true, false]) {
    assert.deepEqual(parseReleaseEvaluation(`server_evaluation:\n  enabled: ${enabled}`, server), { supported: true, enabled });
  }
  for (const config of ['{}', 'server_evaluation: {enabled: "false"}', 'server_evaluation: {enabled: "${some.value}"}']) {
    assert.throws(() => parseReleaseEvaluation(config, server), /true or false/);
  }
  assert.throws(() => parseReleaseEvaluation('server_evaluation: {enabled: false}', 'legacy_main()'), /compatible/);
});

test('old immutable runtimes are not silently upgraded to client-metric OFF', () => {
  assert.equal(supportsEvaluationOverride(contract), true);
  assert.equal(supportsEvaluationOverride({ ...contract, fedopsVersion: '1.1.30.19+onprem.20260916' }), true);
  assert.equal(supportsEvaluationOverride({ ...contract, fedopsVersion: '1.1.30.15+onprem.20260916' }), false);
  assert.equal(supportsEvaluationOverride({ ...contract, fedopsVersion: '1.1.30.15' }), false);
  assert.equal(supportsEvaluationOverride({ name: 'legacy-v1' }), false);
});

test('reader verifies the published archive, caches by immutable identity and cleans temporary files', async () => {
  let downloads = 0, destination;
  const read = createReleaseEvaluationReader({
    download: async args => { downloads++; destination = args.destination; assert.equal(args.fileName, 'published.zip'); },
    checksum: async () => 'hash',
    extract: async (_, name) => Buffer.from(name.endsWith('.yaml') ? 'server_evaluation: {enabled: true}' : server),
  });
  const task = { _id: 'task' }, release = { releaseId: 'r1', bundleSha256: 'hash', bundleName: 'published.zip' };
  const results = await Promise.all([read(task, release, contract), read(task, release, contract)]);
  assert.equal(downloads, 1);
  assert.deepEqual(results[0], { supported: true, enabled: true });
  await assert.rejects(fs.access(destination.replace(/\/release.zip$/, '')));
  await read(task, release, contract);
  assert.equal(downloads, 1);
  await read(task, { ...release, releaseId: 'r2' }, contract);
  assert.equal(downloads, 2);
});

test('failed reads and checksum failures return unavailable, never an invented OFF value', async () => {
  let extracted = false;
  const read = createReleaseEvaluationReader({
    download: async () => {}, checksum: async () => 'wrong',
    extract: async () => { extracted = true; },
  });
  const result = await read({ _id: 'task' }, { releaseId: 'r', bundleSha256: 'hash' }, contract);
  assert.equal(result.enabled, null);
  assert.equal(result.supported, false);
  assert.equal(extracted, false);
});
