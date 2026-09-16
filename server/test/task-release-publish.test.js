import assert from 'node:assert/strict';
import test from 'node:test';

import { taskReleasePublishPolicy } from '../src/lib/taskReleasePublish.js';


test('a public Federated Task can publish a Ready Release directly', () => {
  assert.deepEqual(taskReleasePublishPolicy({ visibility: 'public', modelType: 'AI' }), {
    allowed: true,
    makePublic: false,
    visibility: 'public',
  });
});

test('publishing a private Federated Task requires an explicit make-public action', () => {
  assert.equal(
    taskReleasePublishPolicy({ visibility: 'private', modelType: 'AI' }).allowed,
    false,
  );
  assert.deepEqual(
    taskReleasePublishPolicy(
      { visibility: 'private', modelType: 'AI' },
      { makePublic: true },
    ),
    {
      allowed: true,
      makePublic: true,
      visibility: 'public',
    },
  );
});

test('SBA-FL Tasks remain excluded from Registry publishing', () => {
  assert.equal(
    taskReleasePublishPolicy(
      { visibility: 'private', modelType: 'SBA-FL' },
      { makePublic: true },
    ).allowed,
    false,
  );
});
