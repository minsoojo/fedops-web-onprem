import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import Koa from 'koa';
import axios from 'axios';
import Task from '../src/models/task.js';
import CampaignRun from '../src/models/campaign_run.js';
import router from '../src/api/serverControl/index.js';
import { buildDefaultTaskRuntimeContract } from '../src/lib/taskRuntimeContract.js';

test('stop declares intent before kill, finalizes readiness, and preserves already-completed runs', async () => {
  const original = { find: Task.findBytitle, post: axios.post, update: CampaignRun.updateOne };
  const task = { _id: 'task', ownerId: 'owner', currentCampaignRunId: 'run-12345678',
    runtimeContract: buildDefaultTaskRuntimeContract({ version: '0.19.0' }) };
  Task.findBytitle = async () => task;
  let calls = [], saved, completed = false, stale = false;
  CampaignRun.updateOne = async (filter, update) => { saved = { filter, update }; };
  axios.post = async (url, body) => {
    calls.push(body.phase || 'kill');
    if (stale) throw Object.assign(new Error('Campaign changed'), { response: { status: 409, data: { detail: 'Campaign changed' } } });
    if (body.phase) {
      assert.match(url, /EndCampaign\/task-key$/);
      assert.equal(body.runId, task.currentCampaignRunId);
    }
    return { data: { output: 'FL Server stopped', Server_Status: { Campaign_status: completed ? 'completed' : 'stopping',
      Campaign_ended_at: completed ? '2026-09-08T00:00:00Z' : null } } };
  };
  const app = new Koa();
  app.use(async (ctx, next) => { ctx.state.user = { _id: 'owner' }; await next(); });
  app.use(router.routes());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const send = () => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port,
      path: '/stop-fl-server/task-key', method: 'POST' }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end();
  });
  try {
    assert.equal(await send(), 200);
    assert.deepEqual(calls, ['request', 'kill', 'finished']);
    assert.equal(saved.update.$set.status, 'stopped');
    assert.deepEqual(saved.filter.status, { $in: ['starting', 'running'] });
    completed = true; calls = [];
    assert.equal(await send(), 200);
    assert.equal(saved.update.$set.status, 'completed');
    stale = true; calls = []; saved = null;
    assert.equal(await send(), 409);
    assert.deepEqual(calls, ['request']);
    assert.equal(saved, null);
  } finally {
    Task.findBytitle = original.find; axios.post = original.post; CampaignRun.updateOne = original.update;
    await new Promise(resolve => server.close(resolve));
  }
});
