import fs from 'node:fs';
import axios from 'axios';
import { serverManagerUrl as FL_SERVER_MANAGER_URL } from '../../config/serverManager.js';
import mongoose from 'mongoose';
import os from 'node:os';
import path from 'node:path';

import {
  deleteRegistryFile,
  downloadRegistryFile,
  putRegistryFile,
  registryFileStream,
} from '../../integrations/registryApi.js';
import {
  MAX_MODEL_BYTES,
  MAX_RELEASE_ENTRY_BYTES,
  MAX_RELEASE_BUNDLE_BYTES,
  cleanupUpload,
  extractReleaseEntry,
  initialModelName,
  inspectReleaseArchive,
  newReleaseId,
  previewLanguage,
  receiveIdempotentBinaryUpload,
  releaseBundleName,
  sha256File,
  verifyRegistryReadBack,
} from '../../lib/taskReleases.js';
import {
  canManageTask,
  canViewTask,
  taskPermissions,
} from '../../lib/taskAccess.js';
import { resolveTaskRuntimeContract } from '../../lib/taskRuntimeContract.js';
import { verifyRuntimeArtifactToken } from '../../lib/runtimeArtifactToken.js';
import { normalizeCampaignConfig } from '../../lib/campaignConfig.js';
import { taskReleasePublishPolicy } from '../../lib/taskReleasePublish.js';
import ModelVersion from '../../models/model_version.js';
import RegisteredModel from '../../models/registered_model.js';
import Task from '../../models/task.js';
import TaskRelease from '../../models/task_release.js';
import CampaignRun from '../../models/campaign_run.js';
import { canCompleteCampaign } from '../../lib/campaignCompletion.js';


const modelSummary = (model) => ({
  modelVersionId: String(model._id),
  version: model.version,
  role: model.role,
  origin: model.origin,
  format: model.format,
  fileName: model.registryFileName || model.fileName,
  size: model.size,
  sha256: model.checksum,
  parameterSignatureFingerprint: model.parameterSignatureFingerprint,
});

const releaseResponse = async (release) => {
  const source = typeof release.toObject === 'function' ? release.toObject() : release;
  const model = await ModelVersion.findById(source.modelVersionId).lean();
  return {
    releaseId: source.releaseId,
    revision: source.revision,
    baseline: source.baseline,
    bundleSize: source.bundleSize,
    bundleSha256: source.bundleSha256,
    manifestSha256: source.manifestSha256,
    sourceFingerprint: source.sourceFingerprint,
    files: source.files.map((file) => {
      const value = typeof file.toObject === 'function' ? file.toObject() : file;
      return {
        ...value,
        id: Buffer.from(value.path, 'utf8').toString('base64url'),
      };
    }),
    model: model ? modelSummary(model) : null,
    readiness: source.readiness,
    catalog: source.catalog || source.readiness?.registryCatalog || null,
    status: source.status,
    createdAt: source.createdAt,
    readyAt: source.readyAt,
    publishedAt: source.publishedAt,
  };
};

const taskById = async (ctx, manage = false) => {
  if (!mongoose.isValidObjectId(ctx.params.taskId)) {
    ctx.status = 404;
    ctx.body = { message: 'Federated Task not found.' };
    return null;
  }
  const task = await Task.findById(ctx.params.taskId);
  if (!task) {
    ctx.status = 404;
    ctx.body = { message: 'Federated Task not found.' };
    return null;
  }
  const allowed = manage
    ? canManageTask(ctx.state.user, task)
    : await canViewTask(ctx.state.user, task);
  if (!allowed) {
    ctx.status = 403;
    ctx.body = { message: 'You do not have access to this Federated Task.' };
    return null;
  }
  return task;
};

const requireBinary = (ctx) => {
  if (ctx.request.type !== 'application/octet-stream' && ctx.request.type !== 'application/zip') {
    ctx.throw(415, 'Use application/octet-stream for FedOps artifact uploads.');
  }
};

const artifactErrorStatus = (error) => (
  error?.isRegistryApiError ? 503 : (error?.statusCode || 400)
);

import { publicManagerUrl, aggregationHost } from '../../config/deployment.js';

const authorizedParticipation = async (ctx) => {
  const task = await taskById(ctx, false);
  if (!task) return null;
  const permissions = await taskPermissions(ctx.state.user, task);
  if (!(permissions.isOwner || permissions.isParticipant || permissions.canManage)) {
    ctx.status = 403;
    ctx.body = {
      message: 'Owner access or approved Federated Learning participation is required.',
    };
    return null;
  }
  return { task, permissions };
};

const managerSnapshot = async (runtimeKey) => {
  const encoded = encodeURIComponent(runtimeKey);
  const [connection, readiness, summary] = await Promise.allSettled([
    axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/getConnectionInfo/${encoded}`, { timeout: 5000 }),
    axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/CheckServerReady/${encoded}`, { timeout: 5000 }),
    axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/GetTaskSummary/${encoded}`, { timeout: 5000 }),
  ]);
  const connectionInfo = connection.status === 'fulfilled' ? connection.value.data : null;
  const readyInfo = readiness.status === 'fulfilled' ? readiness.value.data : null;
  const summaryInfo = summary.status === 'fulfilled' ? summary.value.data : null;
  const host = aggregationHost();
  const port = Number(connectionInfo?.port || 0) || null;
  return {
    state: readyInfo?.ready || readyInfo?.FLSeReady ? 'ready' : (port ? 'allocated' : 'not_allocated'),
    ready: Boolean(readyInfo?.ready || readyInfo?.FLSeReady),
    managerUrl: publicManagerUrl(),
    aggregationServer: port ? `${host}:${port}` : null,
    host: port ? host : null,
    port,
    campaignRun: summaryInfo?.fl_server_info || null,
    observedAt: new Date().toISOString(),
  };
};

export const uploadInitialModel = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  requireBinary(ctx);
  const checksum = ctx.get('X-FedOps-SHA256').toLowerCase();
  const signature = ctx.get('X-FedOps-Parameter-Signature').toLowerCase();
  const requestedModelName = String(ctx.get('X-FedOps-Model-Name') || '').trim().slice(0, 120);
  const registeredModelName = requestedModelName
    || task.primaryModel?.workingName
    || task.displayName
    || task.title;
  if (!/^[a-f0-9]{64}$/.test(signature)) ctx.throw(400, 'A parameter signature fingerprint is required.');
  let upload;
  let registryFileName = null;
  try {
    const received = await receiveIdempotentBinaryUpload(
      ctx.req,
      {
        maxBytes: MAX_MODEL_BYTES,
        expectedSha256: checksum,
      },
      () => ModelVersion.findOne({
        taskId: task._id,
        checksum,
        role: 'initial',
        storageBackend: 'registry_api',
        status: 'ready',
      }).lean(),
    );
    upload = received.upload;
    const { existing } = received;
    if (existing) {
      ctx.body = modelSummary(existing);
      return;
    }
    const registered = await RegisteredModel.findOneAndUpdate(
      { taskId: task._id, name: registeredModelName },
      {
        $setOnInsert: {
          taskId: task._id,
          ownerId: task.ownerId || task.user?._id,
          name: registeredModelName,
          visibility: 'inherit',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const latest = await ModelVersion.findOne({ registeredModelId: registered._id })
      .sort({ version: -1 }).select('version').lean();
    const version = Number(latest?.version || 0) + 1;
    registryFileName = initialModelName(version, checksum);
    await putRegistryFile({
      namespace: 'global-models',
      taskId: task._id,
      fileName: registryFileName,
      filePath: upload.filePath,
      contentType: 'application/octet-stream',
    });
    await verifyRegistryReadBack(
      (destination) => downloadRegistryFile({
        namespace: 'global-models', taskId: task._id, fileName: registryFileName, destination,
      }),
      upload,
    );
    const model = await ModelVersion.create({
      registeredModelId: registered._id,
      taskId: task._id,
      version,
      artifactKey: `registry:${task._id}:${registryFileName}`,
      storageBackend: 'registry_api',
      registryFileName,
      fileName: registryFileName,
      contentType: 'application/octet-stream',
      size: upload.size,
      checksum,
      framework: ctx.get('X-FedOps-Framework') || 'pytorch',
      format: ctx.get('X-FedOps-Model-Format') || 'safetensors',
      role: 'initial',
      origin: ctx.get('X-FedOps-Model-Origin') || 'centrally-trained',
      parameterSignatureFingerprint: signature,
      status: 'ready',
      createdBy: ctx.state.user._id,
    });
    registered.latestVersionId = model._id;
    registered.aliases.latest = model._id;
    await registered.save();
    ctx.status = 201;
    ctx.body = modelSummary(model);
  } catch (error) {
    if (registryFileName) {
      try {
        await deleteRegistryFile({ namespace: 'global-models', taskId: task._id, fileName: registryFileName });
      } catch (cleanupError) {
        console.error('Registry model cleanup failed:', cleanupError);
      }
    }
    ctx.status = artifactErrorStatus(error);
    ctx.body = { message: error.message };
  } finally {
    await cleanupUpload(upload);
  }
};

export const uploadRelease = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  requireBinary(ctx);
  const checksum = ctx.get('X-FedOps-SHA256').toLowerCase();
  let upload;
  let bundleName = null;
  let release = null;
  try {
    const received = await receiveIdempotentBinaryUpload(
      ctx.req,
      {
        maxBytes: MAX_RELEASE_BUNDLE_BYTES,
        expectedSha256: checksum,
      },
      () => TaskRelease.findOne({ taskId: task._id, bundleSha256: checksum }),
    );
    upload = received.upload;
    const { existing } = received;
    if (existing) {
      ctx.body = await releaseResponse(existing);
      return;
    }
    const inspected = await inspectReleaseArchive(upload.filePath, task._id);
    const latest = await TaskRelease.findOne({ taskId: task._id }).sort({ revision: -1 }).lean();
    const revision = Number(latest?.revision || 0) + 1;
    bundleName = releaseBundleName(revision, checksum);
    release = await TaskRelease.create({
      releaseId: newReleaseId(),
      taskId: task._id,
      createdBy: ctx.state.user._id,
      revision,
      baseline: inspected.manifest.baseline,
      bundleName,
      bundleSize: upload.size,
      bundleSha256: checksum,
      manifestSha256: inspected.manifestSha256,
      sourceFingerprint: inspected.manifest.sourceFingerprint,
      readme: inspected.readme,
      files: inspected.files.map((file) => ({
        ...file,
        previewable: Boolean(previewLanguage(file.path)),
      })),
      modelVersionId: inspected.modelVersion._id,
      readiness: inspected.manifest.readiness,
      catalog: inspected.catalog,
      status: 'uploading',
    });
    await putRegistryFile({
      namespace: 'task-assets',
      taskId: task._id,
      fileName: bundleName,
      filePath: upload.filePath,
      // The existing Registry API is an opaque binary store. Keep ZIP
      // semantics in Web metadata instead of requiring an API content-type change.
      contentType: 'application/octet-stream',
    });
    await verifyRegistryReadBack(
      (destination) => downloadRegistryFile({
        namespace: 'task-assets', taskId: task._id, fileName: bundleName, destination,
      }),
      upload,
    );
    release.status = 'ready';
    release.readyAt = new Date();
    await release.save();
    task.registryStatus = 'ready';
    await task.save();
    ctx.status = 201;
    ctx.body = await releaseResponse(release);
  } catch (error) {
    if (release) {
      release.status = 'rejected';
      release.error = String(error.message).slice(0, 500);
      await release.save().catch(() => {});
    }
    if (bundleName) {
      try {
        await deleteRegistryFile({ namespace: 'task-assets', taskId: task._id, fileName: bundleName });
      } catch (cleanupError) {
        console.error('Registry release cleanup failed:', cleanupError);
      }
    }
    // A transient Registry failure must not make the immutable bundle hash
    // impossible to retry because of the unique (taskId, bundleSha256) index.
    if (release) await release.deleteOne().catch(() => {});
    ctx.status = artifactErrorStatus(error);
    ctx.body = { message: error.message };
  } finally {
    await cleanupUpload(upload);
  }
};

export const listReleases = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  const releases = await TaskRelease.find({ taskId: task._id }).sort({ revision: -1 });
  ctx.body = { items: await Promise.all(releases.map(releaseResponse)) };
};

export const readTaskContext = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  ctx.body = {
    taskId: String(task._id),
    title: task.displayName || task.title,
    displayName: task.displayName || task.title,
    runtimeKey: task.runtimeKey || task.title,
    ownerHandle: task.ownerHandle || null,
    visibility: task.visibility || 'private',
    registryStatus: task.registryStatus || 'legacy',
    currentPublishedReleaseId: task.currentPublishedReleaseId || null,
    baselineTemplate: task.baselineTemplate || null,
    runtimeContract: resolveTaskRuntimeContract(task),
    primaryModel: task.primaryModel || null,
    taskCategory: task.taskCategory || null,
    dataModality: task.dataModality || null,
  };
};

export const readRelease = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  const release = await TaskRelease.findOne({ taskId: task._id, releaseId: ctx.params.releaseId });
  if (!release) ctx.throw(404, 'Task Release not found.');
  ctx.body = await releaseResponse(release);
};

export const publishRelease = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  const publishPolicy = taskReleasePublishPolicy(task, ctx.request.body);
  if (!publishPolicy.allowed) ctx.throw(409, publishPolicy.message);
  const release = await TaskRelease.findOne({
    taskId: task._id,
    releaseId: ctx.params.releaseId,
    status: 'ready',
  });
  if (!release) ctx.throw(409, 'Only a Ready Task Release can be published.');
  await TaskRelease.updateMany(
    { taskId: task._id, status: 'published', _id: { $ne: release._id } },
    { $set: { status: 'deprecated' } },
  );
  release.status = 'published';
  release.publishedAt = new Date();
  await release.save();
  task.registryStatus = 'published';
  task.visibility = publishPolicy.visibility;
  task.currentPublishedReleaseId = release.releaseId;
  task.publishedAt = release.publishedAt;
  if (release.readme) task.cardMarkdown = release.readme;
  const catalog = release.catalog || release.readiness?.registryCatalog;
  if (catalog?.primaryModel?.displayName) {
    task.primaryModel = {
      ...(task.primaryModel?.toObject?.() || task.primaryModel || {}),
      displayName: catalog.primaryModel.displayName,
      workingName: task.primaryModel?.workingName || catalog.primaryModel.displayName,
      framework: catalog.primaryModel.framework || null,
      format: catalog.primaryModel.format || null,
      parameterSignatureFingerprint:
        catalog.primaryModel.parameterSignatureFingerprint || null,
    };
    const publishedModel = await ModelVersion.findById(release.modelVersionId).lean();
    if (publishedModel?.registeredModelId) {
      await RegisteredModel.updateOne(
        { _id: publishedModel.registeredModelId, taskId: task._id },
        { $set: { name: catalog.primaryModel.displayName } },
      );
    }
  }
  await task.save();
  ctx.body = await releaseResponse(release);
};

export const withdrawRelease = async (ctx) => {
  const task = await taskById(ctx, true);
  if (!task) return;
  const release = await TaskRelease.findOne({ taskId: task._id, releaseId: ctx.params.releaseId });
  if (!release) ctx.throw(404, 'Task Release not found.');
  if (release.status === 'published') release.status = 'deprecated';
  await release.save();
  if (task.currentPublishedReleaseId === release.releaseId) {
    task.registryStatus = 'withdrawn';
    task.currentPublishedReleaseId = undefined;
    task.publishedAt = undefined;
    await task.save();
  }
  ctx.body = await releaseResponse(release);
};

const publishedFor = async (ctx) => {
  const authorized = await authorizedParticipation(ctx);
  if (!authorized) return null;
  const { task } = authorized;
  if (task.registryStatus !== 'published' || !task.currentPublishedReleaseId) {
    ctx.status = 404;
    ctx.body = { message: 'No Published Task Release is available.' };
    return null;
  }
  const release = await TaskRelease.findOne({
    taskId: task._id,
    releaseId: task.currentPublishedReleaseId,
    status: 'published',
  });
  if (!release) {
    ctx.status = 404;
    ctx.body = { message: 'Published Task Release metadata is unavailable.' };
    return null;
  }
  return { task, release };
};

export const readPublishedRelease = async (ctx) => {
  const selected = await publishedFor(ctx);
  if (selected) {
    const permissions = await taskPermissions(ctx.state.user, selected.task);
    ctx.body = {
      ...await releaseResponse(selected.release),
      task: {
        taskId: String(selected.task._id),
        title: selected.task.displayName || selected.task.title,
        displayName: selected.task.displayName || selected.task.title,
        runtimeKey: selected.task.runtimeKey || selected.task.title,
        ownerHandle: selected.task.ownerHandle || null,
        registryStatus: selected.task.registryStatus,
        runtimeContract: resolveTaskRuntimeContract(selected.task),
        primaryModel: selected.task.primaryModel || null,
        permissions,
      },
    };
  }
};

export const downloadPublishedArchive = async (ctx) => {
  const selected = await publishedFor(ctx);
  if (!selected) return;
  ctx.type = 'application/zip';
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('ETag', `"${selected.release.bundleSha256}"`);
  ctx.set('Content-Disposition', `attachment; filename="${selected.release.bundleName}"`);
  ctx.body = registryFileStream({
    namespace: 'task-assets',
    taskId: selected.task._id,
    fileName: selected.release.bundleName,
  });
};

export const previewPublishedFile = async (ctx) => {
  const selected = await publishedFor(ctx);
  if (!selected) return;
  let filePath;
  try {
    filePath = Buffer.from(ctx.params.fileId, 'base64url').toString('utf8');
  } catch {
    ctx.throw(404, 'Release file not found.');
  }
  const file = selected.release.files.find((entry) => entry.path === filePath);
  const language = file && previewLanguage(file.path);
  if (!file || !language) ctx.throw(415, 'This release file cannot be previewed.');
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fedops-preview-'));
  const archive = path.join(directory, selected.release.bundleName);
  try {
    await downloadRegistryFile({
      namespace: 'task-assets',
      taskId: selected.task._id,
      fileName: selected.release.bundleName,
      destination: archive,
    });
    if (await sha256File(archive) !== selected.release.bundleSha256) {
      throw new Error('Published Task Release failed checksum verification.');
    }
    const content = await extractReleaseEntry(archive, file.path);
    const fileSource = typeof file.toObject === 'function' ? file.toObject() : file;
    ctx.body = {
      file: { id: ctx.params.fileId, ...fileSource },
      language,
      content: content.toString('utf8'),
      truncated: false,
      previewBytes: content.length,
    };
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
};

export const downloadPublishedFile = async (ctx) => {
  const selected = await publishedFor(ctx);
  if (!selected) return;
  let filePath;
  try {
    filePath = Buffer.from(ctx.params.fileId, 'base64url').toString('utf8');
  } catch {
    ctx.throw(404, 'Release file not found.');
  }
  const file = selected.release.files.find((entry) => entry.path === filePath);
  if (!file) ctx.throw(404, 'Release file not found.');
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fedops-file-'));
  const archive = path.join(directory, selected.release.bundleName);
  try {
    await downloadRegistryFile({
      namespace: 'task-assets',
      taskId: selected.task._id,
      fileName: selected.release.bundleName,
      destination: archive,
    });
    if (await sha256File(archive) !== selected.release.bundleSha256) {
      throw new Error('Published Task Release failed checksum verification.');
    }
    ctx.type = file.contentType || 'application/octet-stream';
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('ETag', `"${file.sha256}"`);
    ctx.set('Content-Disposition', `attachment; filename="${path.basename(file.path)}"`);
    ctx.body = await extractReleaseEntry(archive, file.path, MAX_RELEASE_ENTRY_BYTES);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
};

export const downloadModelArtifact = async (ctx) => {
  const authorized = await authorizedParticipation(ctx);
  if (!authorized) return;
  const { task } = authorized;
  if (!mongoose.isValidObjectId(ctx.params.modelVersionId)) ctx.throw(404, 'Model Version not found.');
  const model = await ModelVersion.findOne({
    _id: ctx.params.modelVersionId,
    taskId: task._id,
    storageBackend: 'registry_api',
    status: 'ready',
  }).lean();
  if (!model?.registryFileName) ctx.throw(404, 'Model Version not found.');
  ctx.type = model.contentType || 'application/octet-stream';
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('ETag', `"${model.checksum}"`);
  ctx.set('Content-Disposition', `attachment; filename="${model.registryFileName}"`);
  ctx.body = registryFileStream({
    namespace: 'global-models',
    taskId: task._id,
    fileName: model.registryFileName,
  });
};

export const readParticipationManifest = async (ctx) => {
  const selected = await authorizedParticipation(ctx);
  if (!selected) return;
  const { task, permissions } = selected;
  if (!(permissions.isOwner || permissions.isParticipant)) {
    ctx.status = 403;
    ctx.body = {
      message: 'Owner access or approved Federated Learning participation is required.',
    };
    return;
  }
  if (task.registryStatus !== 'published' || !task.currentPublishedReleaseId) {
    ctx.throw(409, 'A Published Task Release is required for participation.');
  }
  const release = await TaskRelease.findOne({
    taskId: task._id,
    releaseId: task.currentPublishedReleaseId,
    status: 'published',
  }).lean();
  if (!release) ctx.throw(409, 'Published Task Release metadata is unavailable.');
  const model = await ModelVersion.findOne({
    _id: release.modelVersionId,
    taskId: task._id,
    status: 'ready',
  }).lean();
  if (!model) ctx.throw(409, 'The Published Task Release has no Ready Initial Model.');
  const runtimeKey = task.runtimeKey || task.title;
  const server = await managerSnapshot(runtimeKey);
  const campaignRun = task.currentCampaignRunId
    ? await CampaignRun.findOne({
      taskId: task._id,
      runId: task.currentCampaignRunId,
    }).lean()
    : null;
  const managerCampaignRun = server.campaignRun;
  if (canCompleteCampaign(campaignRun, managerCampaignRun)) {
    campaignRun.status = 'completed';
    campaignRun.endedAt = new Date(managerCampaignRun.campaign_ended_at);
    await CampaignRun.updateOne(
      { _id: campaignRun._id, status: { $in: ['starting', 'running'] } },
      { $set: { status: 'completed', endedAt: campaignRun.endedAt } },
    );
  }
  const recommendedCampaign = release.catalog?.federation?.recommendedCampaign || {};
  const supportedStrategies = release.catalog?.federation?.supportedStrategies
    || [task.strategy || 'FedAvg'];
  const campaign = normalizeCampaignConfig(
    task.campaignConfig || {
      rounds: recommendedCampaign.rounds || Number(task.numRounds || 2),
      clientsPerRound: recommendedCampaign.clients_per_round
        || recommendedCampaign.clientsPerRound
        || Number(task.clientPerRound || 1),
      strategy: recommendedCampaign.strategy || task.strategy || supportedStrategies[0],
    },
    supportedStrategies,
  );
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
  ctx.body = {
    schemaVersion: 1,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    task: {
      taskId: String(task._id),
      runtimeKey,
      title: task.displayName || task.title,
      primaryModel: task.primaryModel || null,
      runtimeContract: resolveTaskRuntimeContract(task),
    },
    participation: {
      role: permissions.isOwner
        ? 'owner'
        : permissions.isParticipant
          ? 'participant'
          : 'admin',
      status: 'approved',
    },
    release: {
      releaseId: release.releaseId,
      revision: release.revision,
      bundleSha256: release.bundleSha256,
      bundleSize: release.bundleSize,
      sourceFingerprint: release.sourceFingerprint,
    },
    globalModel: {
      modelVersionId: String(model._id),
      version: model.version,
      role: model.role,
      format: model.format,
      size: model.size,
      sha256: model.checksum,
      parameterSignatureFingerprint: model.parameterSignatureFingerprint,
      artifactUrl: `/fedops/api/task-releases/tasks/${task._id}/models/${model._id}/artifact`,
    },
    campaign: {
      ...campaign,
      updatedAt: task.campaignConfig?.updatedAt || null,
    },
    campaignRun: campaignRun ? {
      runId: campaignRun.runId,
      status: campaignRun.status,
      releaseId: campaignRun.releaseId,
      baseGlobalModelVersion: campaignRun.baseGlobalModelVersion,
      targetGlobalModelVersion: campaignRun.targetGlobalModelVersion,
      campaign: campaignRun.campaign,
      startedAt: campaignRun.startedAt,
      endedAt: campaignRun.endedAt,
    } : null,
    server,
  };
};

const runtimeArtifactSelection = async (ctx) => {
  let claims;
  try {
    claims = verifyRuntimeArtifactToken(ctx.params.token);
  } catch (error) {
    ctx.throw(403, error.message);
  }
  if (!mongoose.isValidObjectId(claims.taskId) || !mongoose.isValidObjectId(claims.modelVersionId)) {
    ctx.throw(403, 'Invalid runtime artifact identity.');
  }
  const task = await Task.findById(claims.taskId).lean();
  if (
    !task
    || task.currentPublishedReleaseId !== claims.releaseId
    || task.registryStatus !== 'published'
  ) {
    ctx.throw(409, 'The runtime artifact token no longer identifies the Published Release.');
  }
  const release = await TaskRelease.findOne({
    taskId: task._id,
    releaseId: claims.releaseId,
    status: 'published',
  }).lean();
  const model = await ModelVersion.findOne({
    _id: claims.modelVersionId,
    taskId: task._id,
    status: 'ready',
  }).lean();
  if (!release || !model || String(release.modelVersionId) !== String(model._id)) {
    ctx.throw(409, 'The runtime Release and Initial Model do not match.');
  }
  return { task, release, model };
};

export const downloadRuntimeArchive = async (ctx) => {
  const { task, release } = await runtimeArtifactSelection(ctx);
  ctx.type = 'application/zip';
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('ETag', `"${release.bundleSha256}"`);
  ctx.set('X-FedOps-SHA256', release.bundleSha256);
  ctx.body = registryFileStream({
    namespace: 'task-assets',
    taskId: task._id,
    fileName: release.bundleName,
  });
};

export const downloadRuntimeModel = async (ctx) => {
  const { task, model } = await runtimeArtifactSelection(ctx);
  if (!model.registryFileName) ctx.throw(409, 'The Initial Model artifact is unavailable.');
  ctx.type = model.contentType || 'application/octet-stream';
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('ETag', `"${model.checksum}"`);
  ctx.set('X-FedOps-SHA256', model.checksum);
  ctx.body = registryFileStream({
    namespace: 'global-models',
    taskId: task._id,
    fileName: model.registryFileName,
  });
};
