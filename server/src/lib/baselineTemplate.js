import path from 'node:path';

const DEFAULT_NAME = 'federated-task-baseline';
const DEFAULT_VERSION = '0.12.0';
const DEFAULT_REVISION = 1;
const TEMPLATE_ROOT = 'task-hub/_templates';

const cleanSegment = (value, label) => {
  const segment = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)) {
    throw new Error(`Invalid Baseline ${label}: ${value}`);
  }
  return segment;
};

export const getDefaultBaselineTemplate = () => ({
  name: cleanSegment(
    process.env.TASK_BASELINE_TEMPLATE_NAME || DEFAULT_NAME,
    'name',
  ),
  version: cleanSegment(
    process.env.TASK_BASELINE_TEMPLATE_VERSION || DEFAULT_VERSION,
    'version',
  ),
  revision: Number(
    process.env.TASK_BASELINE_TEMPLATE_REVISION || DEFAULT_REVISION,
  ),
});

export const templateObjectPrefix = ({ name, version }) => (
  `${TEMPLATE_ROOT}/${cleanSegment(name, 'name')}/${cleanSegment(version, 'version')}`
);

export const isSafeTemplatePath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\\')) return false;
  if (path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value
    && normalized !== '.'
    && !normalized.startsWith('../')
    && !normalized.includes('/../');
};

export const validateBaselineManifest = (manifest, expectedTemplate) => {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Baseline manifest must be a JSON object.');
  }
  const baseline = manifest.baseline;
  if (!baseline || typeof baseline !== 'object') {
    throw new Error('Baseline manifest has no baseline metadata.');
  }
  if (baseline.name !== expectedTemplate.name) {
    throw new Error('Baseline manifest name does not match the selected template.');
  }
  if (baseline.release_version !== expectedTemplate.version) {
    throw new Error('Baseline manifest version does not match the selected template.');
  }
  if (Number(baseline.template_revision) !== Number(expectedTemplate.revision)) {
    throw new Error('Baseline manifest revision does not match the selected template.');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Baseline manifest has no files.');
  }

  const seenPaths = new Set();
  manifest.files.forEach((file) => {
    if (!file || typeof file !== 'object' || !isSafeTemplatePath(file.path)) {
      throw new Error(`Invalid Baseline manifest path: ${file?.path}`);
    }
    if (seenPaths.has(file.path)) {
      throw new Error(`Duplicate Baseline manifest path: ${file.path}`);
    }
    seenPaths.add(file.path);
    if (!/^[a-f0-9]{64}$/.test(file.sha256 || '')) {
      throw new Error(`Invalid Baseline checksum: ${file.path}`);
    }
    if (!Number.isInteger(file.size) || file.size < 0) {
      throw new Error(`Invalid Baseline size: ${file.path}`);
    }
    if (typeof file.content_type !== 'string' || !file.content_type) {
      throw new Error(`Invalid Baseline content type: ${file.path}`);
    }
  });
  return manifest;
};

export const taskTemplateSelection = (task) => {
  const selected = task?.baselineTemplate;
  if (!selected?.name || !selected?.version || !selected?.revision) return null;
  return {
    name: cleanSegment(selected.name, 'name'),
    version: cleanSegment(selected.version, 'version'),
    revision: Number(selected.revision),
  };
};

export const taskTemplateDestinationPrefix = (task, template) => (
  `task-hub/${task._id}/files/baseline-${cleanSegment(template.version, 'version')}`
);

export const manifestRoleToTaskFileKind = (role) => {
  if (role === 'documentation') return 'documentation';
  if (role === 'model_code') return 'model_code';
  if (role === 'data_preparation') return 'data_preparation';
  if (['flower_config', 'task_config'].includes(role)) return 'config';
  return 'other';
};
