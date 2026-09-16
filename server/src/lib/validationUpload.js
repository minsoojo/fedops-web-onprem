import { Transform } from 'stream';

export const MAX_VALIDATION_ARCHIVE = 520 * 1024 * 1024;

export function validationHeaders(headers) {
  const digest = headers['x-fedops-sha256'];
  const length = Number(headers['content-length']);
  if (headers['x-fedops-server-data-consent'] !== 'true') throw new Error('Explicit server storage consent is required.');
  if (!/^[a-f0-9]{64}$/.test(digest || '')) throw new Error('A validation dataset checksum is required.');
  if (headers['content-type'] !== 'application/zip') throw new Error('Expected a ZIP validation archive.');
  if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_VALIDATION_ARCHIVE) throw new Error('Validation archive exceeds the upload limit.');
  return { 'content-type': 'application/zip', 'content-length': String(length), 'x-fedops-sha256': digest };
}

export function boundedValidationStream(expected) {
  let bytes = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > expected || bytes > MAX_VALIDATION_ARCHIVE) callback(new Error('Validation upload too large.'));
      else callback(null, chunk);
    },
    flush(callback) { callback(bytes === expected ? null : new Error('Validation upload incomplete.')); },
  });
}
