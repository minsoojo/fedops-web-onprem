import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  aggregationServerStartCommand,
  aggregationServerStopCommand,
  campaignEnvironmentCommand,
  classicServerStartCommand,
  classicServerStopCommand,
} from '../src/lib/serverStartCommand.js';

test('classic aggregation servers prefer the PVC runtime with a legacy fallback', () => {
  assert.match(classicServerStartCommand, /\/app\/data\/runtime\/venv\/bin\/python/);
  assert.match(classicServerStartCommand, /RUNTIME_PYTHON=python3/);
  assert.match(classicServerStartCommand, /import fedops,hydra,flwr,omegaconf/);
  assert.equal(
    aggregationServerStartCommand({ name: 'legacy-v1' }),
    classicServerStartCommand,
  );
  assert.equal(
    spawnSync('/bin/sh', ['-n', '-c', classicServerStartCommand]).status,
    0,
  );
});

test('classic aggregation stop keeps the legacy process contract', () => {
  assert.equal(
    aggregationServerStopCommand({ name: 'legacy-v1' }),
    classicServerStopCommand,
  );
  assert.match(classicServerStopCommand, /pkill/);
  assert.equal(spawnSync('/bin/sh', ['-n', '-c', classicServerStopCommand]).status, 0);
});

test('v3 aggregation stop targets the recorded process and clears its PID', () => {
  const command = aggregationServerStopCommand({ name: 'federated-task-v3' });
  assert.match(command, /\/app\/data\/fl-server\.pid/);
  assert.match(command, /kill "\$PID"/);
  assert.match(command, /rm -f "\$PID_FILE"/);
  assert.doesNotMatch(command, /pkill/);
  assert.equal(spawnSync('/bin/sh', ['-n', '-c', command]).status, 0);
});

test('v3 aggregation servers retain the exact Release environment', () => {
  const command = aggregationServerStartCommand({ name: 'federated-task-v3' });
  assert.match(command, /\.venv\/bin\/python -m federated_task\.federated_learning\.server_main/);
  assert.doesNotMatch(command, /\/app\/data\/runtime\/venv/);
  assert.match(command, /kill -0/);
  assert.match(command, /trap stop TERM INT/);
  assert.match(command, /cleanup; exit/);
  assert.match(command, /rm -f "\$PID_FILE"/);
  assert.equal(
    spawnSync('/bin/sh', ['-n', '-c', command]).status,
    0,
  );
});

test('v3 aggregation start applies the latest saved Campaign to the process', () => {
  const campaign = {
    schemaVersion: 1,
    rounds: 4,
    clientsPerRound: 3,
    strategy: { name: 'FedAvg', parameters: { fraction_fit: 0.75 } },
  };
  const environment = campaignEnvironmentCommand(campaign);
  const command = aggregationServerStartCommand(
    { name: 'federated-task-v3' },
    campaign,
  );

  assert.match(environment, /FEDOPS_CAMPAIGN_CONFIG/);
  assert.match(command, /FL_NUM_ROUNDS='4'/);
  assert.match(command, /FL_CLIENT_PER_ROUND='3'/);
  assert.match(command, /FL_STRATEGY='FedAvg'/);
  assert.match(command, /fraction_fit/);
  assert.equal(spawnSync('/bin/sh', ['-n', '-c', command]).status, 0);
  assert.doesNotMatch(
    aggregationServerStartCommand({ name: 'legacy-v1' }, campaign),
    /FEDOPS_CAMPAIGN_CONFIG/,
  );
});

test('v3 aggregation start exports one isolated Campaign Run and rejects overlap', () => {
  const campaign = {
    schemaVersion: 1,
    rounds: 5,
    clientsPerRound: 3,
    strategy: { name: 'FedAvg', parameters: {} },
  };
  const run = {
    runId: 'run-12345678',
    baseGlobalModelVersion: 1,
    targetGlobalModelVersion: 2,
  };
  const command = aggregationServerStartCommand(
    { name: 'federated-task-v3' },
    campaign,
    run,
  );
  assert.match(command, /FEDOPS_CAMPAIGN_RUN_ID='run-12345678'/);
  assert.match(command, /FEDOPS_BASE_GLOBAL_MODEL_VERSION='1'/);
  assert.match(command, /FEDOPS_TARGET_GLOBAL_MODEL_VERSION='2'/);
  assert.match(command, /FL Server is already running/);
  assert.equal(spawnSync('/bin/sh', ['-n', '-c', command]).status, 0);
  assert.doesNotMatch(
    aggregationServerStartCommand({ name: 'legacy-v1' }, campaign, run),
    /FEDOPS_CAMPAIGN_RUN_ID/,
  );
});
