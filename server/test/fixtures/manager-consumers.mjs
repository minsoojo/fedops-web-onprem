// Isolated consumer check: real HTTP to loopback, in-memory DB and socket adapters.
import '../../src/config/serverManager.js';
import http from 'node:http';
import assert from 'node:assert/strict';
import Koa from 'koa';
import axios from 'axios';
import Task from '../../src/models/task.js';
import router from '../../src/api/serverControl/index.js';
import taskSockets from '../../src/sockets/taskSockets.js';

axios.defaults.proxy = false;
console.log('Consumer fixture imports ready');
Task.findBytitle = async () => ({ ownerId: 'owner' });
const app = new Koa();
app.use(async (ctx, next) => { ctx.state.user = { _id: 'owner' }; await next(); });
app.use(router.routes());
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
console.log('Consumer fixture listening');
try {
  const status = await new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: server.address().port,
      method: 'POST', path: '/create-scalable/test' }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  assert.equal(status, 409); // Stub Manager reports an already-running Task.
  console.log('Consumer HTTP route checked');
  const handlers = new Map();
  const emitted = [];
  taskSockets({ on(event, callback) {
    assert.equal(event, 'connection');
    callback({ id: 'local-test', user: { _id: 'owner' },
      on: (name, handler) => handlers.set(name, handler),
      emit: (name, data) => emitted.push({ name, data }),
    });
  } });
  await handlers.get('requestData')('test');
  assert.deepEqual(emitted.map(item => item.name), ['updateTask', 'updateFlServerStatus']);
  let reply;
  await handlers.get('startTrain')({ taskId: 'test', devices: [], serverRepoAddr: 'local-fixture' },
    value => { reply = value; });
  assert.equal(reply.status, 'Task started.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
