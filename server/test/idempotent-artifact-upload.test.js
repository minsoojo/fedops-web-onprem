import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  cleanupUpload,
  receiveIdempotentBinaryUpload,
} from '../src/lib/taskReleases.js';


test('duplicate lookup runs only after the complete artifact body is verified', async () => {
  const body = Buffer.alloc(3 * 1024 * 1024, 7);
  const checksum = createHash('sha256').update(body).digest('hex');
  const request = Readable.from([
    body.subarray(0, 1024 * 1024),
    body.subarray(1024 * 1024, 2 * 1024 * 1024),
    body.subarray(2 * 1024 * 1024),
  ]);
  let bodyEnded = false;
  request.on('end', () => {
    bodyEnded = true;
  });

  const duplicate = { artifactId: 'existing-artifact' };
  const received = await receiveIdempotentBinaryUpload(
    request,
    { maxBytes: 4 * 1024 * 1024, expectedSha256: checksum },
    async () => {
      assert.equal(bodyEnded, true);
      return duplicate;
    },
  );

  try {
    assert.equal(received.existing, duplicate);
    assert.equal(received.upload.size, body.length);
    assert.equal(received.upload.sha256, checksum);
    assert.equal(fs.statSync(received.upload.filePath).size, body.length);
  } finally {
    await cleanupUpload(received.upload);
  }
});
