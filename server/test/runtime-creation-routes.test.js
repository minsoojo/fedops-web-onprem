import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Koa from 'koa';
import axios from 'axios';
import Task from '../src/models/task.js';
import router from '../src/api/serverControl/index.js';

test('all Web Create routes authorize before status checks and reject existing runtimes without writes', async () => {
  const original = { find: Task.findBytitle, get: axios.get, post: axios.post, update: Task.updateOne };
  let reads = 0;
  let writes = 0;
  Task.findBytitle = async () => ({ ownerId: 'owner' });
  axios.get = async url => {
    reads++;
    assert.match(url, /\/web-control\/status\/test$/);
    return { data: { deployment: { replicas: 1, ready_replicas: 1 }, pods: [{ phase: 'Running', ready: true }] } };
  };
  axios.post = Task.updateOne = async () => { writes++; assert.fail('must not mutate'); };
  const app = new Koa();
  app.use(async (ctx, next) => { if (ctx.get('x-test-user')) ctx.state.user = { _id: ctx.get('x-test-user') }; await next(); });
  app.use(router.routes());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const send = (path, user) => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method: 'POST',
      headers: user ? { 'x-test-user': user } : {} }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  try {
    for (const route of ['create-scalable', 'create-scalable-with-config', 'create-scalable-from-saved']) {
      const before = reads;
      assert.equal(await send(`/${route}/test`), 401);
      assert.equal(await send(`/${route}/test`, 'participant'), 403);
      assert.equal(reads, before);
      assert.equal(await send(`/${route}/test`, 'owner'), 409);
      assert.equal(reads, before + 1);
    }
    assert.equal(writes, 0);
  } finally {
    Task.findBytitle = original.find; axios.get = original.get; axios.post = original.post; Task.updateOne = original.update;
    await new Promise(resolve => server.close(resolve));
  }
});
