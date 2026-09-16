import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectTaskModification,
  taskModificationMode,
} from '../src/lib/taskModification.js';

const v3Task = {
  runtimeContract: { name: 'federated-task-v3', baselineVersion: '0.18.0' },
  currentPublishedReleaseId: 'release-1',
};

test('v3 modification accepts Registry metadata and rejects runtime fields', () => {
  assert.equal(taskModificationMode(v3Task), 'federated-task-v3');
  assert.deepEqual(selectTaskModification(v3Task, {
    displayName: 'Updated Task',
    summary: 'Updated summary',
    visibility: 'public',
    learningRate: '9',
    yamlConfig: 'unsafe',
    currentPublishedReleaseId: 'release-2',
    runtimeKey: 'changed',
  }), {
    displayName: 'Updated Task',
    summary: 'Updated summary',
    visibility: 'public',
  });
});

test('v3 visibility changes do not rewrite immutable publication fields', () => {
  assert.deepEqual(selectTaskModification(v3Task, {
    visibility: 'private',
    registryStatus: 'withdrawn',
    currentPublishedReleaseId: null,
    publishedAt: null,
  }), {
    visibility: 'private',
  });
});

test('legacy modification retains legacy training and YAML settings', () => {
  const legacyTask = { title: 'legacy-task' };
  assert.equal(taskModificationMode(legacyTask), 'legacy-v1');
  assert.deepEqual(selectTaskModification(legacyTask, {
    title: 'legacy-task',
    learningRate: '0.01',
    yamlConfig: 'config: legacy',
    displayName: 'not-a-legacy-field',
  }), {
    title: 'legacy-task',
    learningRate: '0.01',
    yamlConfig: 'config: legacy',
  });
});
