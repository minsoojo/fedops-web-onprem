import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeCreationGuard, runtimeCreationConflict } from '../src/lib/runtimeCreationGuard.js';

const missing = { deployment: { error: 'Deployment not found' }, pods: [] };
const context = () => ({ params: { taskId: 'test' } });
const succeed = ctx => async () => { ctx.status = 200; ctx.body = { success: true }; };

test('only confirmed missing Deployment and no Pods permit creation', () => {
  assert.equal(runtimeCreationConflict(missing), null);
  assert.equal(runtimeCreationConflict({ ...missing, pvc: { phase: 'Bound' } }), null);
  for (const snapshot of [null, {}, { deployment: {}, pods: [] },
    { deployment: { error: 'Forbidden' }, pods: [] },
    { deployment: { replicas: 1 }, pods: [] },
    { deployment: { replicas: 0 }, pods: [] },
    { ...missing, pods: [{ phase: 'Failed' }] },
    { ...missing, fl_server_status: { status: 'FL Server Running' } },
  ]) assert.ok(runtimeCreationConflict(snapshot));
});

test('existing runtime and unavailable status never call the mutating handler', async () => {
  for (const getStatus of [async () => ({ deployment: { replicas: 1 }, pods: [] }),
    async () => { throw new Error('offline'); }]) {
    const ctx = context();
    await createRuntimeCreationGuard({ getStatus })(ctx, () => assert.fail('must not create'));
    assert.ok([409, 503].includes(ctx.status));
  }
});

test('concurrent and immediately repeated creation is blocked during background allocation', async () => {
  let complete;
  let now = 0;
  const guard = createRuntimeCreationGuard({ getStatus: () => new Promise(resolve => { complete = resolve; }), now: () => now, holdMs: 100 });
  const first = context();
  const pending = guard(first, succeed(first));
  const second = context();
  await guard(second, () => assert.fail('duplicate'));
  assert.equal(second.status, 409);
  complete(missing);
  await pending;
  const third = context();
  await guard(third, () => assert.fail('background duplicate'));
  assert.equal(third.status, 409);
  now = 101;
  const retry = context();
  const retryPending = guard(retry, succeed(retry));
  complete(missing);
  await retryPending;
  assert.equal(retry.status, 200);
});

test('failed creation releases the pending guard for retry', async () => {
  const guard = createRuntimeCreationGuard({ getStatus: async () => missing });
  const failed = context();
  await guard(failed, async () => { failed.status = 500; });
  const retry = context();
  await guard(retry, succeed(retry));
  assert.equal(retry.status, 200);
});
