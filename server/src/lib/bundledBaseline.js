import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/federated-task-baseline',
);
const DEFAULT_VERSION = '0.19.0';
const DEFAULT_REVISION = 1;
const SUPPORTED_VERSIONS = ['0.19.0', '0.18.0', '0.17.0', '0.16.0', '0.15.0', '0.14.0', '0.13.0', '0.12.0', '0.11.0', '0.10.0', '0.9.0', '0.8.0', '0.7.0', '0.6.0', '0.5.0', '0.4.0', '0.3.0'];
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;

const cachedReleases = new Map();

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const artifactId = (filePath, checksum) => sha256(`${filePath}\0${checksum}`);

const safeRelativePath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\\')) return false;
  if (path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value
    && normalized !== '.'
    && !normalized.startsWith('../')
    && !normalized.includes('/../');
};

const verifiedFile = (filesRoot, entry) => {
  if (!entry || typeof entry !== 'object' || !safeRelativePath(entry.path)) {
    throw new Error('Bundled Baseline contains an unsafe file path.');
  }
  const absolutePath = path.join(filesRoot, ...entry.path.split('/'));
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(`${filesRoot}${path.sep}`) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Bundled Baseline file is missing: ${entry.path}`);
  }
  const content = fs.readFileSync(resolved);
  if (content.length !== entry.size || sha256(content) !== entry.sha256) {
    throw new Error(`Bundled Baseline file failed checksum verification: ${entry.path}`);
  }
  return {
    ...entry,
    artifactId: artifactId(entry.path, entry.sha256),
    absolutePath: resolved,
  };
};

const loadRelease = (version = DEFAULT_VERSION) => {
  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new Error(`Bundled Baseline version is unavailable: ${version}`);
  }
  if (cachedReleases.has(version)) return cachedReleases.get(version);
  const root = path.join(ASSETS_ROOT, version);
  const filesRoot = path.join(root, 'files');
  const manifestPath = path.join(root, 'baseline-manifest.json');
  const provenancePath = path.join(root, 'provenance.json');
  const manifestBody = fs.readFileSync(manifestPath);
  if (manifestBody.length > MAX_MANIFEST_BYTES) {
    throw new Error('Bundled Baseline manifest exceeds its size limit.');
  }
  const manifest = JSON.parse(manifestBody.toString('utf8'));
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  if (
    manifest?.schema_version !== 2
    || manifest?.baseline?.name !== 'federated-task-baseline'
    || manifest?.baseline?.release_version !== version
    || !Number.isInteger(Number(manifest?.baseline?.template_revision))
    || Number(manifest?.baseline?.template_revision) < 1
    || !Array.isArray(manifest?.files)
    || manifest.files.length === 0
  ) {
    throw new Error('Bundled Baseline manifest metadata is invalid.');
  }
  const manifestChecksum = sha256(manifestBody);
  if (
    provenance.baseline !== manifest.baseline.name
    || provenance.version !== version
    || Number(provenance.revision) !== Number(manifest.baseline.template_revision)
    || provenance.manifestSha256 !== manifestChecksum
  ) {
    throw new Error('Bundled Baseline provenance does not match its manifest.');
  }
  const files = manifest.files.map((entry) => verifiedFile(filesRoot, entry));
  const ids = new Set(files.map((file) => file.artifactId));
  if (ids.size !== files.length) {
    throw new Error('Bundled Baseline contains duplicate artifact identifiers.');
  }
  const manifestFile = {
    path: 'baseline-manifest.json',
    role: 'release_manifest',
    editable: false,
    content_type: 'application/json; charset=utf-8',
    size: manifestBody.length,
    sha256: manifestChecksum,
    artifactId: artifactId('baseline-manifest.json', manifestChecksum),
    absolutePath: manifestPath,
  };
  const byId = new Map([
    [manifestFile.artifactId, manifestFile],
    ...files.map((file) => [file.artifactId, file]),
  ]);
  const release = { manifest, provenance, manifestFile, files, byId, filesRoot };
  cachedReleases.set(version, release);
  return release;
};

export const getBundledBaselineTemplate = () => ({
  name: 'federated-task-baseline',
  version: DEFAULT_VERSION,
  revision: DEFAULT_REVISION,
});

export const getBundledBaselineSession = (version = DEFAULT_VERSION) => {
  const { manifest, provenance, manifestFile, files } = loadRelease(version);
  const descriptor = (file) => ({
    path: file.path,
    role: file.role,
    editable: Boolean(file.editable),
    contentType: file.content_type,
    size: file.size,
    sha256: file.sha256,
    artifactId: file.artifactId,
  });
  return {
    distribution: 'bundled',
    release: {
      name: manifest.baseline.name,
      version: manifest.baseline.release_version,
      revision: Number(manifest.baseline.template_revision),
      schemaVersion: Number(manifest.schema_version),
      manifestSha256: manifestFile.sha256,
      fileCount: files.length,
      totalSize: files.reduce((total, file) => total + Number(file.size), 0),
      sourceCommit: provenance.sourceCommit,
    },
    manifest: descriptor(manifestFile),
    files: files.map(descriptor),
  };
};

export const getBundledBaselineArtifact = (id) => {
  for (const version of SUPPORTED_VERSIONS) {
    const release = loadRelease(version);
    const selected = release.byId.get(id);
    if (!selected) continue;
    return selected.path === 'baseline-manifest.json'
      ? loadRelease(version).manifestFile
      : verifiedFile(release.filesRoot, selected);
  }
  return null;
};
