import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { validationHeaders, boundedValidationStream } from '../src/lib/validationUpload.js';

test('validation upload requires explicit consent, ZIP size and checksum', () => {
  const headers = { 'content-type': 'application/zip', 'content-length': '12',
    'x-fedops-sha256': 'a'.repeat(64), 'x-fedops-server-data-consent': 'true' };
  assert.equal(validationHeaders(headers)['content-length'], '12');
  for (const [key, value] of [['x-fedops-server-data-consent', 'false'], ['x-fedops-sha256', '../path'],
    ['content-length', '9999999999999'], ['content-type', 'application/json']]) {
    assert.throws(() => validationHeaders({ ...headers, [key]: value }));
  }
});

test('stream rejects oversized and truncated requests', async () => {
  for (const expected of [1, 5]) {
    await assert.rejects(pipeline(Readable.from([Buffer.from('abc')]), boundedValidationStream(expected), async source => {
      for await (const chunk of source) void chunk;
    }));
  }
  await pipeline(Readable.from([Buffer.from('abc')]), boundedValidationStream(3), async source => {
    for await (const chunk of source) assert.equal(chunk.toString(), 'abc');
  });
});
