import assert from 'node:assert/strict';
import test from 'node:test';
import { logout } from '../src/api/auth/auth.ctrl.js';

test('logout expires the shared access cookie immediately for every FedOps route', async () => {
  const writes = [];
  const ctx = {
    cookies: {
      set: (...args) => writes.push(args),
    },
    status: null,
  };

  await logout(ctx);

  assert.equal(ctx.status, 204);
  assert.deepEqual(writes, [[
    'access_token',
    null,
    {
      maxAge: 0,
      httpOnly: true,
      overwrite: true,
      path: '/',
    },
  ]]);
});
