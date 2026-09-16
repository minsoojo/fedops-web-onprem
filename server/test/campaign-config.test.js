import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeCampaignConfig,
  normalizeServerEvaluation,
  serverManagerCampaignFields,
} from '../src/lib/campaignConfig.js';

test('explicit evaluation mode is preserved; old campaigns keep Release defaults', () => {
  assert.equal(normalizeCampaignConfig({}).serverEvaluation, undefined);
  assert.deepEqual(normalizeCampaignConfig({ serverEvaluation: { enabled: false } }).serverEvaluation, { enabled: false });
  assert.deepEqual(normalizeServerEvaluation({ enabled: true, dataPath: 'ecg/validation' }), { enabled: true, dataPath: 'ecg/validation' });
  for (const dataPath of ['', '/etc', '../x', 'a/../b', 'a//b', 'a\\b', 'a\nx']) {
    assert.throws(() => normalizeServerEvaluation({ enabled: true, dataPath }), /relative directory/);
  }
  assert.throws(() => normalizeServerEvaluation({ enabled: 'false' }), /boolean/);
  assert.throws(() => normalizeCampaignConfig({ serverEvaluation: { enabled: false }, strategy: { name: 'FedAvg', parameters: { fraction_evaluate: 0 } } }), /fraction_evaluate/);
});


test('Campaign values are normalized independently from a Task Release', () => {
  assert.deepEqual(
    normalizeCampaignConfig(
      {
        rounds: 5,
        clientsPerRound: 2,
        strategy: { name: 'FedAvg', parameters: { fraction_fit: 0.75 } },
      },
      ['FedAvg'],
    ),
    {
      schemaVersion: 1,
      rounds: 5,
      clientsPerRound: 2,
      strategy: { name: 'FedAvg', parameters: { fraction_fit: 0.75 } },
    },
  );
});

test('Campaign rejects unsupported strategies and parameters', () => {
  assert.throws(
    () => normalizeCampaignConfig({ strategy: 'FedAdam' }, ['FedAvg']),
    /not supported/,
  );
  assert.throws(
    () => normalizeCampaignConfig({ strategy: { name: 'FedAvg', parameters: { secret: 1 } } }),
    /Unsupported strategy parameters/,
  );
});

test('Campaign uses numeric metadata and legacy string fields at the Server Manager boundary', () => {
  const campaign = normalizeCampaignConfig({
    rounds: 2,
    clientsPerRound: 1,
    strategy: { name: 'FedAvg', parameters: {} },
  });
  assert.equal(typeof campaign.rounds, 'number');
  assert.equal(typeof campaign.clientsPerRound, 'number');
  assert.deepEqual(serverManagerCampaignFields(campaign), {
    num_rounds: '2',
    client_per_round: '1',
    strategy: 'FedAvg',
  });
});
