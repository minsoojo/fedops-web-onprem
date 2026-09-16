import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRuntimeArtifactToken,
  verifyRuntimeArtifactToken,
} from '../src/lib/runtimeArtifactToken.js';


test('runtime artifact token binds an exact current Published Release and survives Pod restarts', () => {
  const previous = process.env.RUNTIME_ARTIFACT_SECRET;
  process.env.RUNTIME_ARTIFACT_SECRET = 'test-only-runtime-secret';
  try {
    const token = createRuntimeArtifactToken({
      taskId: '64b000000000000000000010',
      releaseId: 'release-01',
      modelVersionId: '64b000000000000000000020',
    });
    const claims = verifyRuntimeArtifactToken(token);
    assert.equal(claims.taskId, '64b000000000000000000010');
    assert.equal(claims.releaseId, 'release-01');
    assert.equal(claims.modelVersionId, '64b000000000000000000020');
    assert.equal(claims.version, 2);
    assert.equal(claims.purpose, 'published-release-runtime');
    assert.equal(claims.expiresAt, undefined);
    assert.throws(
      () => verifyRuntimeArtifactToken(`${token.slice(0, -1)}x`),
      /Invalid runtime artifact token/,
    );
  } finally {
    if (previous === undefined) delete process.env.RUNTIME_ARTIFACT_SECRET;
    else process.env.RUNTIME_ARTIFACT_SECRET = previous;
  }
});

test('time-limited v1 runtime artifact tokens remain compatible', () => {
  const previous = process.env.RUNTIME_ARTIFACT_SECRET;
  process.env.RUNTIME_ARTIFACT_SECRET = 'test-only-runtime-secret';
  try {
    const token = createRuntimeArtifactToken({
      taskId: '64b000000000000000000010',
      releaseId: 'release-01',
      modelVersionId: '64b000000000000000000020',
    }, 60);
    const claims = verifyRuntimeArtifactToken(token);
    assert.equal(claims.version, 1);
    assert.ok(claims.expiresAt > claims.issuedAt);
  } finally {
    if (previous === undefined) delete process.env.RUNTIME_ARTIFACT_SECRET;
    else process.env.RUNTIME_ARTIFACT_SECRET = previous;
  }
});
