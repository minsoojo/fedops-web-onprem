import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefaultTaskRuntimeContract, resolveTaskRuntimeContract } from '../src/lib/taskRuntimeContract.js';

test('Baseline 0.19 selects optional evaluation without upgrading existing contracts', () => {
  const next = buildDefaultTaskRuntimeContract({ version: '0.19.0' });
  assert.equal(next.fedopsVersion, '1.1.30.18');
  assert.equal(next.sourceRevision, '733f1696edc234073f0c1cd1a96e6580bfbcffeb');
  assert.deepEqual(resolveTaskRuntimeContract({ runtimeContract: next }), next);
  const old = buildDefaultTaskRuntimeContract({ version: '0.18.0' });
  assert.equal(old.fedopsVersion, '1.1.30.15');
  assert.deepEqual(resolveTaskRuntimeContract({ runtimeContract: old, baselineTemplate: { version: '0.19.0' } }), old);
  assert.equal(resolveTaskRuntimeContract({ baselineTemplate: { version: '0.19.0' } }).name, 'legacy-v1');
  assert.throws(() => resolveTaskRuntimeContract({ runtimeContract: { ...next, sourceRevision: 'main' } }));
  assert.throws(() => resolveTaskRuntimeContract({ runtimeContract: { ...next, fedopsVersion: '1.1.30.15' } }));
});


test('on-prem Baseline selects its immutable core and preserves existing Task pins', () => {
  const next = buildDefaultTaskRuntimeContract({ version: '0.19.1' });
  assert.equal(next.fedopsVersion, '1.1.30.19+onprem.20260916');
  assert.equal(next.sourceRevision, 'ff5f44ddea2705c8d901a54a0272f517822da8f4');
  assert.deepEqual(resolveTaskRuntimeContract({ runtimeContract: next }), next);
  for (const version of ['0.18.0', '0.19.0']) {
    const old = buildDefaultTaskRuntimeContract({ version });
    assert.deepEqual(resolveTaskRuntimeContract({ runtimeContract: old, baselineTemplate: { version: '0.19.1' } }), old);
  }
  assert.equal(resolveTaskRuntimeContract({ baselineTemplate: { version: '0.19.1' } }).name, 'legacy-v1');
  assert.throws(() => resolveTaskRuntimeContract({ runtimeContract: { ...next, fedopsVersion: '1.1.30.18' } }));
  assert.throws(() => resolveTaskRuntimeContract({ runtimeContract: { ...next, name: 'legacy-v1' } }));
});
