import assert from 'node:assert/strict';
import test from 'node:test';
import { connectValidationDataset } from '../src/lib/validationSelection.js';

test('upload receipt supplies path only for unbound ON Campaigns', () => {
  const uploaded = { dataPath: `validation-${'a'.repeat(64)}` };
  const pending = { rounds: 2, serverEvaluation: { enabled: true } };
  assert.equal(connectValidationDataset(pending, uploaded).serverEvaluation.dataPath, uploaded.dataPath);
  assert.equal(pending.serverEvaluation.dataPath, undefined);
  const saved = { serverEvaluation: { enabled: true, dataPath: 'previous-dataset' } };
  assert.equal(connectValidationDataset(saved, uploaded), saved);
  const off = { serverEvaluation: { enabled: false } };
  assert.equal(connectValidationDataset(off), off);
  assert.throws(() => connectValidationDataset(pending), /Upload validation data/);
  assert.throws(() => connectValidationDataset(pending, { dataPath: '../escape' }), /Upload validation data/);
});
