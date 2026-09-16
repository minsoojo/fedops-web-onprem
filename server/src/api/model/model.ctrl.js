import { createObjectStorage } from '../../config/objectStorage.js';
import mongoose from 'mongoose';
import path from 'path';
import Task from '../../models/task.js';
import RegisteredModel from '../../models/registered_model.js';
import ModelVersion from '../../models/model_version.js';
import TaskRelease from '../../models/task_release.js';
import {
  canViewTask,
  publicRegistryFilter,
  taskPermissions,
} from '../../lib/taskAccess.js';
import { ownerHandleFilter } from '../../lib/taskHandles.js';
import {
  getTaskFileDownload,
  getTaskFilePreview,
  listTaskFiles,
  taskFileStorageConfigured,
} from '../../lib/taskFiles.js';
import {
  loadTaskUsage,
  recordModelDownload,
} from '../../lib/taskUsage.js';


const BUCKET_NAME = process.env.BUCKET_NAME;
const XAI_BUCKET_NAME = process.env.XAI_BUCKET_NAME || 'global-model-xai';
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

const s3 = createObjectStorage();
const signingS3 = createObjectStorage({ signing: true });

const signedDownloadUrl = (bucket, key) => signingS3.getSignedUrlPromise('getObject', {
  Bucket: bucket,
  Key: key,
  Expires: DOWNLOAD_URL_TTL_SECONDS,
  ResponseContentDisposition: `attachment; filename="${encodeURIComponent(path.basename(key))}"`,
});

const loadTaskByRuntimeKey = async (ctx) => {
  const task = await Task.findBytitle(ctx.params.title);
  if (!task) {
    ctx.status = 404;
    ctx.body = { message: 'Task not found.' };
    return null;
  }
  if (!await canViewTask(ctx.state.user, task)) {
    ctx.status = ctx.state.user ? 403 : 401;
    ctx.body = { message: 'You do not have access to this task.' };
    return null;
  }
  return task;
};

const loadPublicTask = async (ctx) => {
  const task = await Task.findOne({
    ...ownerHandleFilter(ctx.params.handle),
    slug: ctx.params.slug,
    ...publicRegistryFilter(),
  });
  if (!task) {
    ctx.status = 404;
    ctx.body = { message: 'Public task not found.' };
    return null;
  }
  return task;
};

const requireArtifactAccess = async (ctx, task) => {
  const permissions = await taskPermissions(ctx.state.user, task);
  if (!permissions.canDownloadModels) {
    ctx.status = 403;
    ctx.body = {
      message: 'Join Federated Learning and receive owner approval to access Files & versions.',
    };
    return null;
  }
  return permissions;
};

const restrictedHub = async (task, permissions) => ({
  task: {
    taskId: String(task._id),
    handle: task.ownerHandle,
    slug: task.slug,
    title: task.title,
  },
  permissions,
  models: [],
  files: [],
  usage: await loadTaskUsage(task),
  artifactsRestricted: true,
});

const releaseHub = async (
  task,
  user,
  knownPermissions = null,
  globalModels = [],
) => {
  if (task.registryStatus !== 'published' || !task.currentPublishedReleaseId) return null;
  const release = await TaskRelease.findOne({
    taskId: task._id,
    releaseId: task.currentPublishedReleaseId,
    status: 'published',
  }).lean();
  if (!release) return null;
  const model = await ModelVersion.findById(release.modelVersionId).lean();
  return {
    task: {
      taskId: String(task._id),
      handle: task.ownerHandle,
      slug: task.slug,
      title: task.title,
    },
    release: {
      releaseId: release.releaseId,
      revision: release.revision,
      status: release.status,
      bundleSha256: release.bundleSha256,
      sourceFingerprint: release.sourceFingerprint,
      publishedAt: release.publishedAt,
    },
    permissions: knownPermissions || await taskPermissions(user, task),
    models: [
      ...(model ? [{
        id: String(model._id),
        registeredModelId: String(model.registeredModelId),
        modelName: task.title,
        name: model.registryFileName || model.fileName,
        version: model.version,
        size: model.size,
        createdAt: model.createdAt,
        role: model.role,
        format: model.format,
        checksum: model.checksum,
        aliases: { latest: globalModels.length === 0 },
        source: 'task_release',
        label: 'Initiative Model',
      }] : []),
      ...globalModels.map((item) => ({
        ...item,
        id: String(item.id),
        registeredModelId: String(item.registeredModelId),
        role: 'global',
        source: 'federated_campaign',
        label: `Global Model v${item.version}`,
      })),
    ],
    files: release.files.map((file) => ({
      id: Buffer.from(file.path, 'utf8').toString('base64url'),
      path: file.path,
      name: path.basename(file.path),
      kind: file.role || 'other',
      source: 'task_release',
      version: release.revision,
      versionCount: release.revision,
      size: file.size,
      checksum: file.sha256,
      contentType: file.contentType,
      editable: Boolean(file.editable),
      previewable: file.previewable,
      createdAt: release.publishedAt || release.createdAt,
      releaseId: release.releaseId,
    })),
  };
};

const inferredVersion = (fileName) => {
  const match = fileName.match(/(?:^|[_\-.])v(?:ersion)?[_-]?(\d+)/i);
  return match ? Number(match[1]) : null;
};

const modelNameFromFile = (fileName) => {
  const extension = path.extname(fileName);
  return fileName
    .slice(0, extension ? -extension.length : undefined)
    .replace(/(?:^|[_\-.])v(?:ersion)?[_-]?\d+.*$/i, '')
    || fileName;
};

const registerArtifact = async (task, content) => {
  const fileName = path.basename(content.Key);
  const modelName = modelNameFromFile(fileName);
  const registeredModel = await RegisteredModel.findOneAndUpdate(
    { taskId: task._id, name: modelName },
    {
      $setOnInsert: {
        taskId: task._id,
        ownerId: task.ownerId || task.user?._id,
        name: modelName,
        visibility: 'inherit',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  let version = await ModelVersion.findOne({ artifactKey: content.Key });
  if (!version) {
    const latest = await ModelVersion.findOne({
      registeredModelId: registeredModel._id,
    }).sort({ version: -1 }).select('version').lean();
    const parsedVersion = inferredVersion(fileName);
    const nextVersion = parsedVersion && parsedVersion > (latest?.version || 0)
      ? parsedVersion
      : (latest?.version || 0) + 1;
    version = await ModelVersion.findOneAndUpdate(
      { artifactKey: content.Key },
      {
        $setOnInsert: {
          registeredModelId: registeredModel._id,
          taskId: task._id,
          version: nextVersion,
          globalModelVersion: parsedVersion || nextVersion,
          artifactKey: content.Key,
          fileName,
          size: content.Size,
          role: 'global',
          origin: 'federated-training',
          format: path.extname(fileName).replace(/^\./, '').toLowerCase() || null,
          status: 'ready',
          createdBy: task.ownerId || task.user?._id,
          createdAt: content.LastModified || new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } else if (
    version.role !== 'global'
    || version.origin !== 'federated-training'
    || !version.globalModelVersion
  ) {
    version = await ModelVersion.findOneAndUpdate(
      { _id: version._id },
      {
        $set: {
          role: 'global',
          origin: 'federated-training',
          globalModelVersion: version.globalModelVersion || inferredVersion(fileName),
          format: version.format
            || path.extname(fileName).replace(/^\./, '').toLowerCase()
            || null,
        },
      },
      { new: true },
    );
  }

  const latestVersion = await ModelVersion.findOne({
    registeredModelId: registeredModel._id,
    status: 'ready',
  }).sort({ version: -1, createdAt: -1 }).select('_id');
  if (latestVersion) {
    registeredModel.latestVersionId = latestVersion._id;
    registeredModel.aliases.latest = latestVersion._id;
    await registeredModel.save();
  }

  return { registeredModel, version };
};

const listTaskModels = async (
  ctx,
  task,
  { includeSignedUrls = true, permissions: knownPermissions = null } = {},
) => {
  if (!BUCKET_NAME) {
    ctx.status = 503;
    ctx.body = { message: 'Model artifact storage is not configured.' };
    return null;
  }

  const runtimeKey = task.runtimeKey || task.title;
  const { Contents = [] } = await s3.listObjectsV2({
    Bucket: BUCKET_NAME,
    Prefix: `${runtimeKey}/`,
  }).promise();
  const artifacts = Contents.filter((content) => (
    content.Key && !content.Key.endsWith('/')
  ));

  const models = [];
  for (const content of artifacts) {
    const { registeredModel, version } = await registerArtifact(task, content);
    const model = {
      id: version._id,
      registeredModelId: registeredModel._id,
      modelName: registeredModel.name,
      name: version.fileName || path.basename(content.Key),
      version: version.globalModelVersion || version.version,
      size: version.size ?? content.Size,
      createdAt: version.createdAt || content.LastModified,
      checksum: version.checksum || null,
      format: version.format || null,
      role: version.role || 'global',
      downloadUrlExpiresIn: DOWNLOAD_URL_TTL_SECONDS,
    };
    if (includeSignedUrls) {
      // 기존 My Task Global Model 관리 화면과의 호환성을 유지한다.
      model.url = await signedDownloadUrl(BUCKET_NAME, content.Key);
    }
    models.push(model);
  }

  const registryRecords = await RegisteredModel.find({
    _id: { $in: models.map((model) => model.registeredModelId) },
  }).select('latestVersionId aliases').lean();
  const registryById = new Map(
    registryRecords.map((record) => [String(record._id), record]),
  );
  const modelsWithAliases = models.map((model) => {
    const registry = registryById.get(String(model.registeredModelId));
    return {
      ...model,
      aliases: {
        latest: String(registry?.latestVersionId || '') === String(model.id),
        best: String(registry?.aliases?.best || '') === String(model.id),
        champion: String(registry?.aliases?.champion || '') === String(model.id),
      },
    };
  });

  return {
    task: {
      handle: task.ownerHandle,
      slug: task.slug,
      title: task.title,
    },
    permissions: knownPermissions || await taskPermissions(ctx.state.user, task),
    models: modelsWithAliases.sort((a, b) => (
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )),
  };
};

export const list = async (ctx) => {
  const task = await loadTaskByRuntimeKey(ctx);
  if (!task) return;
  try {
    const registry = await listTaskModels(ctx, task);
    if (registry) ctx.body = registry.models;
  } catch (error) {
    console.error('Model registry list error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to list model artifacts.' };
  }
};

export const listPublic = async (ctx) => {
  const task = await loadPublicTask(ctx);
  if (!task) return;
  try {
    const permissions = await taskPermissions(ctx.state.user, task);
    if (!permissions.canDownloadModels) {
      ctx.body = await restrictedHub(task, permissions);
      return;
    }
    const globalRegistry = BUCKET_NAME
      ? await listTaskModels(ctx, task, { includeSignedUrls: false, permissions })
      : { models: [] };
    const published = await releaseHub(
      task,
      ctx.state.user,
      permissions,
      globalRegistry?.models || [],
    );
    if (published) {
      ctx.body = { ...published, usage: await loadTaskUsage(task) };
      return;
    }
    if (!taskFileStorageConfigured()) {
      ctx.status = 503;
      ctx.body = { message: 'Task Hub storage is not configured.' };
      return;
    }
    const [registry, files, usage] = await Promise.all([
      listTaskModels(ctx, task, { includeSignedUrls: false, permissions }),
      listTaskFiles(task),
      loadTaskUsage(task),
    ]);
    if (registry) ctx.body = { ...registry, files, usage };
  } catch (error) {
    console.error('Public model registry list error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to list model artifacts.' };
  }
};

const downloadModelVersion = async (ctx, task) => {
  if (!mongoose.isValidObjectId(ctx.params.versionId)) {
    ctx.status = 404;
    ctx.body = { message: 'Model version not found.' };
    return;
  }
  const version = await ModelVersion.findOne({
    _id: ctx.params.versionId,
    taskId: task._id,
    status: 'ready',
  }).lean();
  if (!version) {
    ctx.status = 404;
    ctx.body = { message: 'Model version not found.' };
    return;
  }
  if (version.storageBackend === 'registry_api' && version.registryFileName) {
    try {
      await recordModelDownload({ task, version, user: ctx.state.user });
    } catch (error) {
      console.error('Model download metric error:', error);
    }
    ctx.body = {
      url: `/fedops/api/task-releases/tasks/${task._id}/models/${version._id}/artifact`,
      expiresIn: null,
    };
    return;
  }
  if (!BUCKET_NAME) {
    ctx.status = 503;
    ctx.body = { message: 'Model artifact storage is not configured.' };
    return;
  }
  const url = await signedDownloadUrl(BUCKET_NAME, version.artifactKey);
  try {
    await recordModelDownload({ task, version, user: ctx.state.user });
  } catch (error) {
    console.error('Model download metric error:', error);
  }
  ctx.body = {
    url,
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  };
};

export const downloadVersion = async (ctx) => {
  const task = await loadPublicTask(ctx);
  if (!task) return;
  if (!await requireArtifactAccess(ctx, task)) return;
  await downloadModelVersion(ctx, task);
};

export const readHub = async (ctx) => {
  const task = await loadTaskByRuntimeKey(ctx);
  if (!task) return;
  try {
    const permissions = await taskPermissions(ctx.state.user, task);
    if (!permissions.canDownloadModels) {
      ctx.body = await restrictedHub(task, permissions);
      return;
    }
    const globalRegistry = BUCKET_NAME
      ? await listTaskModels(ctx, task, { includeSignedUrls: false, permissions })
      : { models: [] };
    const published = await releaseHub(
      task,
      ctx.state.user,
      permissions,
      globalRegistry?.models || [],
    );
    if (published) {
      ctx.body = { ...published, usage: await loadTaskUsage(task) };
      return;
    }
    if (!taskFileStorageConfigured()) {
      ctx.status = 503;
      ctx.body = { message: 'Task Hub storage is not configured.' };
      return;
    }
    const [registry, files, usage] = await Promise.all([
      listTaskModels(ctx, task, { includeSignedUrls: false, permissions }),
      listTaskFiles(task),
      loadTaskUsage(task),
    ]);
    if (registry) ctx.body = { ...registry, files, usage };
  } catch (error) {
    console.error('Task Hub artifact list error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to load Task Hub files.' };
  }
};

export const downloadAuthorizedVersion = async (ctx) => {
  const task = await loadTaskByRuntimeKey(ctx);
  if (!task) return;
  if (!await requireArtifactAccess(ctx, task)) return;
  await downloadModelVersion(ctx, task);
};

const downloadTaskFile = async (ctx, task) => {
  if (task.registryStatus === 'published' && task.currentPublishedReleaseId) {
    const filePath = Buffer.from(ctx.params.fileId, 'base64url').toString('utf8');
    const release = await TaskRelease.findOne({
      taskId: task._id,
      releaseId: task.currentPublishedReleaseId,
      status: 'published',
      'files.path': filePath,
    }).select('_id').lean();
    if (release) {
      ctx.body = {
        url: `/fedops/api/task-releases/tasks/${task._id}/published/files/${ctx.params.fileId}/artifact`,
        expiresIn: null,
      };
      return;
    }
  }
  if (!taskFileStorageConfigured()) {
    ctx.status = 503;
    ctx.body = { message: 'Task Hub storage is not configured.' };
    return;
  }
  const download = await getTaskFileDownload(task, ctx.params.fileId);
  if (!download) {
    ctx.status = 404;
    ctx.body = { message: 'Task file not found.' };
    return;
  }
  ctx.body = {
    url: download.url,
    expiresIn: download.expiresIn,
  };
};

export const downloadPublicFile = async (ctx) => {
  const task = await loadPublicTask(ctx);
  if (!task) return;
  if (!await requireArtifactAccess(ctx, task)) return;
  await downloadTaskFile(ctx, task);
};

export const downloadAuthorizedFile = async (ctx) => {
  const task = await loadTaskByRuntimeKey(ctx);
  if (!task) return;
  if (!await requireArtifactAccess(ctx, task)) return;
  await downloadTaskFile(ctx, task);
};

const previewTaskFile = async (ctx, task) => {
  if (task.registryStatus === 'published' && task.currentPublishedReleaseId) {
    const filePath = Buffer.from(ctx.params.fileId, 'base64url').toString('utf8');
    const release = await TaskRelease.findOne({
      taskId: task._id,
      releaseId: task.currentPublishedReleaseId,
      status: 'published',
      'files.path': filePath,
    }).select('_id').lean();
    if (release) {
      ctx.redirect(
        `/fedops/api/task-releases/tasks/${task._id}/published/files/${ctx.params.fileId}/preview`,
      );
      return;
    }
  }
  if (!taskFileStorageConfigured()) {
    ctx.status = 503;
    ctx.body = { message: 'Task Hub storage is not configured.' };
    return;
  }
  const preview = await getTaskFilePreview(task, ctx.params.fileId);
  if (!preview) {
    ctx.status = 404;
    ctx.body = { message: 'Task file not found.' };
    return;
  }
  if (!preview.previewable) {
    ctx.status = 415;
    ctx.body = { message: 'This file type cannot be previewed.' };
    return;
  }
  ctx.body = {
    file: {
      id: preview.file._id,
      path: preview.file.path,
      name: preview.file.fileName || path.basename(preview.file.path),
      version: preview.file.version,
      size: preview.file.size,
      checksum: preview.file.checksum,
      contentType: preview.file.contentType,
    },
    language: preview.language,
    content: preview.content,
    truncated: preview.truncated,
    previewBytes: preview.previewBytes,
  };
};

export const previewPublicFile = async (ctx) => {
  const task = await loadPublicTask(ctx);
  if (!task) return;
  if (!await requireArtifactAccess(ctx, task)) return;
  await previewTaskFile(ctx, task);
};

export const previewAuthorizedFile = async (ctx) => {
  const task = await loadTaskByRuntimeKey(ctx);
  if (!task) return;
  if (!await requireArtifactAccess(ctx, task)) return;
  await previewTaskFile(ctx, task);
};

export const listimg = async (ctx) => {
  const task = await loadTaskByRuntimeKey(ctx);
  if (!task) return;
  const { modelVersion } = ctx.request.body || {};
  try {
    const runtimeKey = task.runtimeKey || task.title;
    const { Contents = [] } = await s3.listObjectsV2({
      Bucket: XAI_BUCKET_NAME,
      Prefix: `${runtimeKey}/MNISTClassifier_local_model_V${modelVersion}.png`,
    }).promise();
    ctx.body = await Promise.all(Contents.map(async (content) => ({
      name: path.basename(content.Key),
      url: await signedDownloadUrl(XAI_BUCKET_NAME, content.Key),
      downloadUrlExpiresIn: DOWNLOAD_URL_TTL_SECONDS,
    })));
  } catch (error) {
    console.error('XAI model list error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to list XAI model artifacts.' };
  }
};
