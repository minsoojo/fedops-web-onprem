import { createObjectStorage } from '../config/objectStorage.js';
import mongoose from 'mongoose';
import path from 'path';
import { createHash } from 'node:crypto';
import TaskFile from '../models/task_file.js';
import Task from '../models/task.js';
import {
  getDefaultBaselineTemplate,
  manifestRoleToTaskFileKind,
  taskTemplateDestinationPrefix,
  taskTemplateSelection,
  templateObjectPrefix,
  validateBaselineManifest,
} from './baselineTemplate.js';


const BUCKET_NAME = process.env.BUCKET_NAME;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
export const TASK_FILE_PREVIEW_MAX_BYTES = 512 * 1024;

const PREVIEW_LANGUAGE_BY_EXTENSION = {
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
};

const s3 = createObjectStorage();
const signingS3 = createObjectStorage({ signing: true });

const checksum = (content) => (
  createHash('sha256').update(content).digest('hex')
);

const taskName = (task) => task.title || 'fedops-task';

export const taskFilePreviewLanguage = (file = {}) => (
  PREVIEW_LANGUAGE_BY_EXTENSION[
    path.extname(file.path || file.fileName || '').toLowerCase()
  ] || null
);

export const isTaskFilePreviewable = (file = {}) => Boolean(
  taskFilePreviewLanguage(file)
);

export const buildDefaultTaskFiles = (task) => {
  const readme = `# Default baseline for ${taskName(task)}

These files define the starting contract for local training and federated participation.

- \`model.py\`: implement and return the local model.
- \`data_preparation.py\`: describe and prepare the expected input features.

The generated baseline is intentionally framework-neutral. The Task owner should publish
task-specific implementations before participants run local training.
`;
  const model = `"""Default FedOps model contract for ${taskName(task)}."""

from typing import Any, Dict, Optional


def build_model(config: Optional[Dict[str, Any]] = None) -> Any:
    """Return the task-specific local model.

    Replace this baseline with a TensorFlow, PyTorch, or supported custom model.
    The returned model must match the global model architecture published by the owner.
    """
    raise NotImplementedError("The Task owner must publish a task-specific model implementation.")
`;
  const dataPreparation = `"""Default FedOps local data preparation contract for ${taskName(task)}."""

from typing import Any, Dict


def describe_input_features() -> Dict[str, Any]:
    """Describe the required local input schema.

    Owners should replace each placeholder with feature names, shapes, dtypes,
    label definitions, missing-value policy, and normalization rules.
    """
    return {
        "features": [],
        "label": None,
        "normalization": None,
        "split": {"train": None, "validation": None, "test": None},
    }


def prepare_data(raw_data: Any) -> Any:
    """Validate and transform local data without uploading raw records."""
    raise NotImplementedError("The Task owner must publish data preparation logic.")
`;

  return [
    {
      path: 'default_baseline/README.md',
      kind: 'documentation',
      contentType: 'text/markdown; charset=utf-8',
      content: readme,
    },
    {
      path: 'default_baseline/model.py',
      kind: 'model_code',
      contentType: 'text/x-python; charset=utf-8',
      content: model,
    },
    {
      path: 'default_baseline/data_preparation.py',
      kind: 'data_preparation',
      contentType: 'text/x-python; charset=utf-8',
      content: dataPreparation,
    },
  ].map((file) => ({
    ...file,
    checksum: checksum(file.content),
    size: Buffer.byteLength(file.content),
  }));
};

export const taskFileStorageConfigured = () => Boolean(BUCKET_NAME);

const headObjectOrNull = async (key) => {
  try {
    return await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: key,
    }).promise();
  } catch (error) {
    if (['NotFound', 'NoSuchKey'].includes(error?.code) || error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

const updateBaselineStatus = async (
  task,
  status,
  error = null,
  fileCount = null,
) => {
  if (!task?._id) return;
  const update = {
    $set: {
      'baselineTemplate.status': status,
      ...(status === 'ready'
        ? {
          'baselineTemplate.initializedAt': new Date(),
          'baselineTemplate.fileCount': fileCount,
        }
        : {}),
    },
    $unset: error ? {} : { 'baselineTemplate.error': '' },
  };
  if (error) {
    update.$set['baselineTemplate.error'] = String(error).slice(0, 500);
    delete update.$unset;
  }
  await Task.updateOne({ _id: task._id }, update);
  if (task.baselineTemplate) {
    task.baselineTemplate.status = status;
    task.baselineTemplate.error = error ? String(error).slice(0, 500) : undefined;
    if (status === 'ready') task.baselineTemplate.fileCount = fileCount;
  }
};

const loadBaselineTemplateRelease = async (template) => {
  const prefix = templateObjectPrefix(template);
  const manifestKey = `${prefix}/baseline-manifest.json`;
  const manifestObject = await s3.getObject({
    Bucket: BUCKET_NAME,
    Key: manifestKey,
  }).promise();
  const manifestBody = Buffer.from(manifestObject.Body || []);
  const manifestChecksum = checksum(manifestBody);
  if (
    manifestObject.Metadata?.sha256
    && manifestObject.Metadata.sha256 !== manifestChecksum
  ) {
    throw new Error('Baseline manifest S3 metadata checksum does not match its body.');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBody.toString('utf8'));
  } catch (error) {
    throw new Error('Baseline manifest in S3 is not valid JSON.', { cause: error });
  }
  validateBaselineManifest(manifest, template);
  return {
    manifest,
    manifestFile: {
      path: 'baseline-manifest.json',
      role: 'task_config',
      editable: false,
      content_type: 'application/json; charset=utf-8',
      size: manifestBody.length,
      sha256: manifestChecksum,
      sourceKey: manifestKey,
    },
    files: manifest.files.map((file) => ({
      ...file,
      sourceKey: `${prefix}/files/${file.path}`,
    })),
  };
};

const baselineSignedDownload = async (file) => {
  const source = await headObjectOrNull(file.sourceKey);
  if (!source) {
    throw new Error(`Baseline release object is missing: ${file.path}`);
  }
  if (
    Number(source.ContentLength) !== Number(file.size)
    || source.Metadata?.sha256 !== file.sha256
  ) {
    throw new Error(`Baseline release object failed verification: ${file.path}`);
  }
  return {
    path: file.path,
    role: file.role,
    editable: Boolean(file.editable),
    contentType: file.content_type,
    size: file.size,
    sha256: file.sha256,
    url: await signingS3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET_NAME,
      Key: file.sourceKey,
      Expires: DOWNLOAD_URL_TTL_SECONDS,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
        path.basename(file.path),
      )}"`,
    }),
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  };
};

export const getDefaultBaselineDownloadSession = async () => {
  if (!taskFileStorageConfigured()) {
    throw new Error('Task file storage is not configured.');
  }
  const template = getDefaultBaselineTemplate();
  const release = await loadBaselineTemplateRelease(template);
  const manifest = await baselineSignedDownload(release.manifestFile);
  const files = await Promise.all(release.files.map(baselineSignedDownload));
  return {
    release: {
      name: template.name,
      version: template.version,
      revision: template.revision,
      schemaVersion: Number(release.manifest.schema_version),
      manifestSha256: release.manifestFile.sha256,
      fileCount: files.length,
      totalSize: files.reduce((total, file) => total + Number(file.size), 0),
    },
    manifest,
    files,
  };
};

const ensureTemplateObjectCopy = async ({
  task,
  template,
  file,
  destinationKey,
}) => {
  const source = await headObjectOrNull(file.sourceKey);
  if (!source) {
    throw new Error(`Baseline template object is missing: ${file.path}`);
  }
  if (
    Number(source.ContentLength) !== Number(file.size)
    || source.Metadata?.sha256 !== file.sha256
  ) {
    throw new Error(`Baseline template object failed checksum metadata: ${file.path}`);
  }

  const existingDestination = await headObjectOrNull(destinationKey);
  if (existingDestination) {
    if (
      Number(existingDestination.ContentLength) !== Number(file.size)
      || existingDestination.Metadata?.sha256 !== file.sha256
    ) {
      throw new Error(`Task Baseline object already differs: ${file.path}`);
    }
    return;
  }
  await s3.copyObject({
    Bucket: BUCKET_NAME,
    CopySource: encodeURI(`${BUCKET_NAME}/${file.sourceKey}`),
    Key: destinationKey,
    ContentType: file.content_type,
    MetadataDirective: 'REPLACE',
    Metadata: {
      task: String(task._id),
      source: 'default_baseline',
      sha256: file.sha256,
      'baseline-name': template.name,
      'baseline-version': template.version,
      'template-revision': String(template.revision),
    },
  }).promise();
};

const ensureTemplateTaskFiles = async (task, template) => {
  const release = await loadBaselineTemplateRelease(template);
  const files = [release.manifestFile, ...release.files];
  const destinationPrefix = taskTemplateDestinationPrefix(task, template);
  for (const file of files) {
    const destinationKey = `${destinationPrefix}/${file.path}`;
    await ensureTemplateObjectCopy({
      task,
      template,
      file,
      destinationKey,
    });
    const record = await TaskFile.findOneAndUpdate(
      {
        taskId: task._id,
        path: file.path,
        version: 1,
      },
      {
        $setOnInsert: {
          taskId: task._id,
          path: file.path,
          version: 1,
          artifactKey: destinationKey,
          fileName: path.basename(file.path),
          contentType: file.content_type,
          size: file.size,
          checksum: file.sha256,
          kind: manifestRoleToTaskFileKind(file.role),
          source: 'default_baseline',
          status: 'ready',
          templateName: template.name,
          templateVersion: template.version,
          templateRevision: template.revision,
          templatePath: file.path,
          createdBy: task.ownerId || task.user?._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (
      record.artifactKey !== destinationKey
      || record.checksum !== file.sha256
      || record.templateName !== template.name
      || record.templateVersion !== template.version
      || Number(record.templateRevision) !== Number(template.revision)
    ) {
      throw new Error(`Task file metadata already differs: ${file.path}`);
    }
  }
  await updateBaselineStatus(task, 'ready', null, files.length);
};

const ensureLegacyDefaultTaskFiles = async (task) => {
  if (!taskFileStorageConfigured()) {
    throw new Error('Task file storage is not configured.');
  }
  const templates = buildDefaultTaskFiles(task);
  const existing = await TaskFile.find({
    taskId: task._id,
    source: 'default_baseline',
    version: 1,
  }).select('path').lean();
  const existingPaths = new Set(existing.map((file) => file.path));

  for (const template of templates) {
    if (existingPaths.has(template.path)) continue;
    const artifactKey = `task-hub/${task._id}/files/v1/${template.path}`;
    await s3.putObject({
      Bucket: BUCKET_NAME,
      Key: artifactKey,
      Body: template.content,
      ContentType: template.contentType,
      Metadata: {
        task: String(task._id),
        source: 'default_baseline',
        sha256: template.checksum,
      },
    }).promise();
    try {
      await TaskFile.create({
        taskId: task._id,
        path: template.path,
        version: 1,
        artifactKey,
        fileName: path.basename(template.path),
        contentType: template.contentType,
        size: template.size,
        checksum: template.checksum,
        kind: template.kind,
        source: 'default_baseline',
        status: 'ready',
        createdBy: task.ownerId || task.user?._id,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
};

export const ensureDefaultTaskFiles = async (task) => {
  if (!taskFileStorageConfigured()) {
    throw new Error('Task file storage is not configured.');
  }
  const template = taskTemplateSelection(task);
  if (!template) {
    // Existing tasks remain on the three-file legacy contract. Hub reads never
    // mix the immutable v2 Baseline into an unversioned Task.
    return ensureLegacyDefaultTaskFiles(task);
  }
  if (
    task.baselineTemplate?.status === 'ready'
    && Number(task.baselineTemplate?.fileCount) > 0
  ) {
    const readyCount = await TaskFile.countDocuments({
      taskId: task._id,
      source: 'default_baseline',
      status: 'ready',
      templateName: template.name,
      templateVersion: template.version,
      templateRevision: template.revision,
    });
    if (readyCount === Number(task.baselineTemplate.fileCount)) return;
  }
  try {
    return await ensureTemplateTaskFiles(task, template);
  } catch (error) {
    await updateBaselineStatus(task, 'failed', error.message);
    throw error;
  }
};

export const listTaskFiles = async (task) => {
  await ensureDefaultTaskFiles(task);
  const records = await TaskFile.find({
    taskId: task._id,
    status: 'ready',
  }).sort({ path: 1, version: -1, createdAt: -1 }).lean();
  const versionsByPath = new Map();
  records.forEach((record) => {
    if (!versionsByPath.has(record.path)) versionsByPath.set(record.path, []);
    versionsByPath.get(record.path).push(record);
  });
  return [...versionsByPath.values()].map((versions) => {
    const latest = versions[0];
    return {
      id: latest._id,
      path: latest.path,
      name: latest.fileName || path.basename(latest.path),
      version: latest.version,
      versionCount: versions.length,
      size: latest.size,
      checksum: latest.checksum,
      contentType: latest.contentType,
      kind: latest.kind,
      source: latest.source,
      templateName: latest.templateName,
      templateVersion: latest.templateVersion,
      templateRevision: latest.templateRevision,
      templatePath: latest.templatePath,
      previewable: isTaskFilePreviewable(latest),
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  });
};

export const getTaskFileDownload = async (task, fileId) => {
  if (!mongoose.isValidObjectId(fileId)) return null;
  const file = await TaskFile.findOne({
    _id: fileId,
    taskId: task._id,
    status: 'ready',
  }).lean();
  if (!file) return null;
  return {
    file,
    url: await signingS3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET_NAME,
      Key: file.artifactKey,
      Expires: DOWNLOAD_URL_TTL_SECONDS,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
        file.fileName || path.basename(file.path),
      )}"`,
    }),
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  };
};

export const getTaskFilePreview = async (task, fileId) => {
  if (!mongoose.isValidObjectId(fileId)) return null;
  const file = await TaskFile.findOne({
    _id: fileId,
    taskId: task._id,
    status: 'ready',
  }).lean();
  if (!file) return null;
  const language = taskFilePreviewLanguage(file);
  if (!language) {
    return {
      file,
      previewable: false,
    };
  }
  const size = Number(file.size) || 0;
  const truncated = size > TASK_FILE_PREVIEW_MAX_BYTES;
  let object;
  try {
    object = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: file.artifactKey,
      Range: `bytes=0-${TASK_FILE_PREVIEW_MAX_BYTES - 1}`,
    }).promise();
  } catch (error) {
    if (size !== 0 || error?.code !== 'InvalidRange') throw error;
    object = { Body: Buffer.alloc(0) };
  }
  return {
    file,
    previewable: true,
    language,
    content: object.Body?.toString('utf8') || '',
    truncated,
    previewBytes: object.Body?.length || 0,
  };
};
