import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregationServerStartCommand, validationCheckCommand, assertAggregationStarted } from '../src/lib/serverStartCommand.js';
import { buildTaskMonitoringSnapshot } from '../src/lib/taskMonitoring.js';
import Task from '../src/models/task.js';
import CampaignRun from '../src/models/campaign_run.js';

test('Task settings and immutable Campaign snapshot retain evaluation selection', () => {
  const serverEvaluation = { enabled: true, dataPath: 'ecg' };
  const task = new Task({ campaignConfig: { serverEvaluation } });
  const run = new CampaignRun({ campaign: { serverEvaluation } });
  assert.deepEqual(task.toObject().campaignConfig.serverEvaluation, serverEvaluation);
  assert.deepEqual(run.toObject().campaign.serverEvaluation, serverEvaluation);
});

test('new mode preflights before starting; legacy start is unchanged', () => {
  const campaign = { rounds: 2, clientsPerRound: 1, serverEvaluation: { enabled: true, dataPath: "patient's-data" } };
  const command = aggregationServerStartCommand({ name: 'federated-task-v3' }, campaign);
  assert.ok(command.indexOf('fedops.server.validation') < command.indexOf('nohup'));
  assert.match(validationCheckCommand(campaign), /FEDOPS_CAMPAIGN_CONFIG/);
  assert.match(command, /'"'"'/); // shell quoting, not interpolation
  assert.doesNotMatch(aggregationServerStartCommand({ name: 'federated-task-v3' }), /fedops.server.validation/);
});

test('a 200 command response without startup confirmation is not success', () => {
  assert.throws(() => assertAggregationStarted({ name: 'federated-task-v3' }, { output: 'Validation directory is empty' }), /did not start/);
  assert.doesNotThrow(() => assertAggregationStarted({ name: 'federated-task-v3' }, { output: 'checked\nFL Server started\n' }));
  assert.doesNotThrow(() => assertAggregationStarted({ name: 'legacy-v1' }, { output: '' }));
});

test('global evaluation source and nulls survive monitoring normalization', () => {
  const snapshot = buildTaskMonitoringSnapshot({ task: { title: 'test' }, globalLogs: [{
    round: 1, gl_model_v: 2, gl_loss: null, gl_accuracy: null,
    evaluation_source: 'client_aggregated', evaluation_status: 'not_evaluated',
    evaluation_clients: 0, evaluation_samples: 0, evaluation_failures: 2,
    campaign_run_id: 'run-1',
  }] });
  assert.equal(snapshot.summary.latestGlobal.loss, null);
  assert.equal(snapshot.summary.latestGlobal.accuracy, null);
  assert.equal(snapshot.summary.latestGlobal.evaluationSource, 'client_aggregated');
  assert.equal(snapshot.summary.latestGlobal.evaluationFailures, 2);
  assert.equal(snapshot.summary.latestGlobal.campaignRunId, 'run-1');
});
