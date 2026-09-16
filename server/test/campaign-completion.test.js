import assert from 'node:assert/strict';
import test from 'node:test';
import { canCompleteCampaign } from '../src/lib/campaignCompletion.js';

test('only matching completed and non-ready Campaign can complete an active Web run', () => {
  const run = { runId: 'run-a', status: 'running' };
  const manager = { campaign_run_id: 'run-a', campaign_ended_at: '2026-09-08T00:00:00Z',
    campaign_status: 'completed', ready: false };
  assert.equal(canCompleteCampaign(run, manager), true);
  for (const patch of [{ ready: true }, { campaign_run_id: 'old-run' },
    { campaign_ended_at: null }, { campaign_status: 'stopped' },
    { campaign_status: 'stopping' }, { campaign_status: 'failed' }]) {
    assert.equal(canCompleteCampaign(run, { ...manager, ...patch }), false);
  }
  for (const status of ['completed', 'stopped', 'failed']) {
    assert.equal(canCompleteCampaign({ ...run, status }, manager), false);
  }
  assert.equal(canCompleteCampaign(run, { ...manager, campaign_status: undefined }), true);
});
