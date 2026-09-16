import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';

import ModelVersion from '../models/model_version.js';


export const MAX_RELEASE_BUNDLE_BYTES = 512 * 1024 * 1024;
export const MAX_MODEL_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_RELEASE_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 512 * 1024;
const FORBIDDEN_PARTS = new Set(['.git', '.venv', '__pycache__', '.fedops-studio', 'dataset', 'datasets']);
const SHA256 = /^[a-f0-9]{64}$/;


export const sha256File = async (filePath) => new Promise((resolve, reject) => {
  const digest = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('data', (chunk) => digest.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(digest.digest('hex')));
});

class UploadVerifier extends Transform {
  constructor(maxBytes) {
    super();
    this.maxBytes = maxBytes;
    this.size = 0;
    this.digest = createHash('sha256');
  }

  _transform(chunk, encoding, callback) {
    this.size += chunk.length;
    if (this.size > this.maxBytes) {
      callback(new Error('Upload exceeds the FedOps artifact size limit.'));
      return;
    }
    this.digest.update(chunk);
    callback(null, chunk);
  }

  checksum() {
    return this.digest.digest('hex');
  }
}

export const receiveBinaryUpload = async (request, { maxBytes, expectedSha256 }) => {
  if (!SHA256.test(expectedSha256 || '')) {
    throw new Error('X-FedOps-SHA256 must be a lowercase SHA-256 value.');
  }
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fedops-upload-'));
  const filePath = path.join(directory, 'artifact.bin');
  const verifier = new UploadVerifier(maxBytes);
  try {
    await pipeline(request, verifier, fs.createWriteStream(filePath, { flags: 'wx' }));
    const checksum = verifier.checksum();
    if (checksum !== expectedSha256) {
      throw new Error('Uploaded artifact checksum does not match X-FedOps-SHA256.');
    }
    return { directory, filePath, size: verifier.size, sha256: checksum };
  } catch (error) {
    await fs.promises.rm(directory, { recursive: true, force: true });
    throw error;
  }
};

export const cleanupUpload = async (upload) => {
  if (upload?.directory) {
    await fs.promises.rm(upload.directory, { recursive: true, force: true });
  }
};

// Agent Studio streams artifact bodies immediately. Looking up an existing
// checksum before consuming the body lets Koa return while the Client is still
// sending, which resets the TCP connection instead of delivering the
// idempotent response. Receive and verify the full body before the lookup so
// both existing and current Agent Studio versions can safely retry an upload.
export const receiveIdempotentBinaryUpload = async (
  request,
  options,
  findExisting,
) => {
  const upload = await receiveBinaryUpload(request, options);
  try {
    return {
      upload,
      existing: await findExisting(),
    };
  } catch (error) {
    await cleanupUpload(upload);
    throw error;
  }
};

const safeArchivePath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/')) return false;
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized.startsWith('../')) return false;
  return !value.split('/').some((part) => !part || part === '.' || part === '..' || FORBIDDEN_PARTS.has(part));
};

const openZip = (filePath) => new Promise((resolve, reject) => {
  yauzl.open(filePath, { lazyEntries: true, autoClose: false }, (error, zip) => {
    if (error) reject(error);
    else resolve(zip);
  });
});

const readZipEntry = (zip, entry, captureLimit = 0) => new Promise((resolve, reject) => {
  zip.openReadStream(entry, (error, stream) => {
    if (error) {
      reject(error);
      return;
    }
    const digest = createHash('sha256');
    const chunks = [];
    let size = 0;
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_RELEASE_ENTRY_BYTES) {
        stream.destroy(new Error(`Release entry exceeds size limit: ${entry.fileName}`));
        return;
      }
      digest.update(chunk);
      if (captureLimit && size <= captureLimit) chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve({
      size,
      sha256: digest.digest('hex'),
      content: captureLimit && size <= captureLimit ? Buffer.concat(chunks) : null,
    }));
  });
});

export const inspectReleaseArchive = async (filePath, taskId) => {
  const zip = await openZip(filePath);
  const entries = new Map();
  let total = 0;
  try {
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', async (entry) => {
        try {
          if (!safeArchivePath(entry.fileName)) {
            throw new Error(`Release archive contains an unsafe path: ${entry.fileName}`);
          }
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (mode === 0o120000) throw new Error(`Release archive contains a symlink: ${entry.fileName}`);
          if (entry.fileName.endsWith('/')) {
            zip.readEntry();
            return;
          }
          if (entries.has(entry.fileName)) throw new Error(`Release archive has a duplicate path: ${entry.fileName}`);
          const captureLimit = entry.fileName === 'release-manifest.json'
            ? MAX_MANIFEST_BYTES
            : (entry.fileName === 'README.md' ? MAX_PREVIEW_BYTES : 0);
          const inspected = await readZipEntry(zip, entry, captureLimit);
          total += inspected.size;
          if (total > MAX_RELEASE_BUNDLE_BYTES) throw new Error('Release uncompressed size exceeds its limit.');
          entries.set(entry.fileName, inspected);
          zip.readEntry();
        } catch (error) {
          reject(error);
        }
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  const manifestEntry = entries.get('release-manifest.json');
  if (!manifestEntry?.content) throw new Error('Release archive has no readable release-manifest.json.');
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.content.toString('utf8'));
  } catch (error) {
    throw new Error('Release manifest is not valid JSON.', { cause: error });
  }
  if (
    manifest?.schemaVersion !== 1
    || String(manifest?.taskId) !== String(taskId)
    || !SHA256.test(manifest?.sourceFingerprint || '')
    || !Array.isArray(manifest?.files)
    || manifest.files.length === 0
  ) {
    throw new Error('Release manifest metadata is invalid.');
  }
  if (
    manifest?.readiness?.ok !== true
    || manifest?.readiness?.mode !== 'release'
    || manifest.readiness.sourceFingerprint !== manifest.sourceFingerprint
    || !manifest.readiness.checkerVersion
  ) {
    throw new Error('Release manifest has no matching successful Release Readiness report.');
  }
  const baselineVersion = String(manifest?.baseline?.version || '');
  const catalog = manifest?.readiness?.registryCatalog;
  if (['0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0'].includes(baselineVersion) && (
    catalog?.schemaVersion !== 1
    || !String(catalog?.primaryModel?.displayName || '').trim()
    || !Array.isArray(catalog?.federation?.supportedStrategies)
    || catalog.federation.supportedStrategies.length === 0
  )) {
    throw new Error('Federated Task Baseline Release has no complete Registry catalog snapshot.');
  }
  const declared = new Map();
  for (const file of manifest.files) {
    if (
      !safeArchivePath(file?.path)
      || file.path === 'release-manifest.json'
      || !Number.isInteger(file.size)
      || file.size < 0
      || !SHA256.test(file.sha256 || '')
      || declared.has(file.path)
    ) {
      throw new Error('Release manifest contains an invalid file descriptor.');
    }
    declared.set(file.path, file);
  }
  const actualPaths = [...entries.keys()].filter((name) => name !== 'release-manifest.json');
  if (actualPaths.length !== declared.size || actualPaths.some((name) => !declared.has(name))) {
    throw new Error('Release archive file set differs from its manifest.');
  }
  for (const [fileName, file] of declared) {
    const actual = entries.get(fileName);
    if (actual.size !== file.size || actual.sha256 !== file.sha256) {
      throw new Error(`Release file failed manifest verification: ${fileName}`);
    }
  }
  const modelVersion = await ModelVersion.findOne({
    _id: manifest.modelVersionId,
    taskId,
    storageBackend: 'registry_api',
    status: 'ready',
  }).lean();
  if (
    !modelVersion
    || manifest?.modelRelease?.sha256 !== modelVersion.checksum
    || manifest?.readiness?.parameterSignatureFingerprint
      !== modelVersion.parameterSignatureFingerprint
  ) {
    throw new Error('Release model identity or parameter signature is invalid.');
  }
  const readme = entries.get('README.md')?.content?.toString('utf8') || null;
  return {
    manifest,
    manifestSha256: manifestEntry.sha256,
    files: [...declared.values()],
    readme,
    modelVersion,
    catalog: catalog || null,
  };
};

export const releaseBundleName = (revision, checksum) => (
  `release-r${String(revision).padStart(6, '0')}-${checksum.slice(0, 16)}.fedops.zip`
);

export const initialModelName = (version, checksum) => (
  `initial-v${String(version).padStart(6, '0')}-${checksum.slice(0, 16)}.safetensors`
);

export const newReleaseId = () => `release-${randomUUID()}`;

export const verifyRegistryReadBack = async (download, upload) => {
  const destination = path.join(upload.directory, `readback-${randomUUID()}`);
  await download(destination);
  const [size, checksum] = await Promise.all([
    fs.promises.stat(destination).then((stat) => stat.size),
    sha256File(destination),
  ]);
  if (size !== upload.size || checksum !== upload.sha256) {
    throw new Error('Registry read-back checksum verification failed.');
  }
};

export const previewLanguage = (filePath) => ({
  '.cfg': 'ini',
  '.csv': 'csv',
  '.ini': 'ini',
  '.json': 'json',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.py': 'python',
  '.toml': 'toml',
  '.txt': 'text',
  '.yaml': 'yaml',
  '.yml': 'yaml',
}[path.extname(filePath).toLowerCase()] || null);

export const extractReleaseEntry = async (archivePath, selectedPath, maxBytes = MAX_PREVIEW_BYTES) => {
  if (!safeArchivePath(selectedPath)) throw new Error('Requested release path is unsafe.');
  const zip = await openZip(archivePath);
  try {
    return await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', () => reject(new Error('Release file not found.')));
      zip.on('entry', async (entry) => {
        try {
          if (entry.fileName !== selectedPath) {
            zip.readEntry();
            return;
          }
          if (entry.uncompressedSize > maxBytes) throw new Error('Release file exceeds preview limit.');
          const result = await readZipEntry(zip, entry, maxBytes);
          resolve(result.content);
        } catch (error) {
          reject(error);
        }
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
};
