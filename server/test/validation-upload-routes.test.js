import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import Koa from 'koa';
import axios from 'axios';
import Task from '../src/models/task.js';
import router from '../src/api/serverControl/index.js';
import { buildDefaultTaskRuntimeContract } from '../src/lib/taskRuntimeContract.js';

test('actual validation routes reject anonymous/participant before proxying and stream Owner bytes', async () => {
  const originalFind = Task.findBytitle;
  const originalPost = axios.post;
  const originalGet = axios.get;
  const originalUpdate = Task.updateOne;
  let saved;
  Task.updateOne = async (_, value) => { saved = value.$set; };
  let forwarded = 0;
  Task.findBytitle = async () => ({ ownerId: 'owner', runtimeContract: buildDefaultTaskRuntimeContract({ version: '0.19.0' }) });
  axios.post = async (url, source, options) => {
    forwarded++;
    assert.match(url, /\/validation-data\/task-key$/);
    assert.equal(options.headers['x-fedops-sha256'], 'a'.repeat(64));
    const chunks = [];
    for await (const chunk of source) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), 'zip');
    return { data: { success: true, dataPath: `validation-${'a'.repeat(64)}`, sha256: 'a'.repeat(64), fileCount: 1, totalBytes: 3 } };
  };
  axios.get = async () => ({ data: { items: [] } });
  const app = new Koa();
  // Only this test server uses a synthetic identity, never production middleware.
  app.use(async (ctx, next) => { if (ctx.get('x-test-user')) ctx.state.user = { _id: ctx.get('x-test-user') }; await next(); });
  app.use(router.routes());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const send = user => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port,
      path: '/validation-data/task-key', method: 'POST', headers: {
        ...(user ? { 'x-test-user': user } : {}), 'content-type': 'application/zip', 'content-length': 3,
        'x-fedops-sha256': 'a'.repeat(64), 'x-fedops-server-data-consent': 'true',
      } }, res => { let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body })); });
    req.on('error', reject); req.end('zip');
  });
  try {
    assert.equal((await send()).status, 401);
    assert.equal((await send('participant')).status, 403);
    assert.equal(forwarded, 0);
    const result = await send('owner');
    assert.equal(result.status, 200, result.body);
    assert.equal(forwarded, 1);
    assert.equal(saved.latestValidationData.dataPath, `validation-${'a'.repeat(64)}`);
    assert.equal(saved.campaignConfig, undefined);
  } finally {
    Task.findBytitle = originalFind; Task.updateOne = originalUpdate; axios.post = originalPost; axios.get = originalGet;
    await new Promise(resolve => server.close(resolve));
  }
});
