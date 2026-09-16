import Router from 'koa-router';
import axios from 'axios';
import { serverManagerUrl as FL_SERVER_MANAGER_URL } from '../../config/serverManager.js';
import { randomUUID } from 'crypto';
// ========== 새로운 임포트 추가 ==========
import { PassThrough } from 'stream';

import Task from '../../models/task.js';
import ModelVersion from '../../models/model_version.js';
import TaskRelease from '../../models/task_release.js';
import CampaignRun from '../../models/campaign_run.js';
import { validationHeaders, boundedValidationStream } from '../../lib/validationUpload.js';
import { connectValidationDataset } from '../../lib/validationSelection.js';
import { readReleaseEvaluation, supportsEvaluationOverride } from '../../lib/releaseEvaluation.js';
import { canManageTask } from '../../lib/taskAccess.js';
import { createRuntimeCreationGuard } from '../../lib/runtimeCreationGuard.js';
import {
  resolveTaskRuntimeContract,
  taskRuntimeManagerPayload,
} from '../../lib/taskRuntimeContract.js';
import { createRuntimeArtifactToken } from '../../lib/runtimeArtifactToken.js';
import {
  normalizeCampaignConfig,
  serverManagerCampaignFields,
} from '../../lib/campaignConfig.js';
import {
  aggregationServerStartCommand,
  aggregationServerStopCommand,
  validationCheckCommand,
  assertAggregationStarted,
} from '../../lib/serverStartCommand.js';

const serverControl = new Router();

const upstreamErrorMessage = (error) => {
  const detail = error.response?.data?.detail
    ?? error.response?.data?.error
    ?? error.response?.data?.message
    ?? error.message;
  if (Array.isArray(detail)) {
    return detail.map((issue) => {
      if (!issue || typeof issue !== 'object') return String(issue);
      const location = Array.isArray(issue.loc) ? issue.loc.filter((part) => part !== 'body').join('.') : '';
      return [location, issue.msg || issue.message].filter(Boolean).join(': ');
    }).filter(Boolean).join(' · ');
  }
  if (detail && typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }
  return String(detail || 'The Server Manager request failed.');
};

// FL Server Manager 서비스 URL (기존 Python FastAPI 서버)
const guardRuntimeCreation = createRuntimeCreationGuard({
  getStatus: async (taskId) => (await axios.get(
    `${FL_SERVER_MANAGER_URL}/web-control/status/${encodeURIComponent(taskId)}`,
    { timeout: 15000 },
  )).data,
});

const isAdminUser = (ctx) => ctx.state.user?.username === 'ccl@ccl.com';

import { runtimeArtifactBaseUrl } from '../../config/deployment.js';

const latestCompletedGlobalModelVersion = async (task) => {
  const runtimeKey = task.runtimeKey || task.title;
  const [registered, metric] = await Promise.all([
    ModelVersion.findOne({ taskId: task._id, role: 'global', status: 'ready' })
      .sort({ globalModelVersion: -1, version: -1, createdAt: -1 })
      .select('globalModelVersion version')
      .lean(),
    Task.db.collection('fl-gl_model_evaluation_log').findOne(
      { fl_task_id: runtimeKey },
      { sort: { gl_model_v: -1, _id: -1 }, projection: { gl_model_v: 1 } },
    ),
  ]);
  // The artifact registry and completed metric are the model lineage sources.
  // Older Server Manager state may contain the historical v1.2/v1.3
  // completion-time double increment, so it must not advance a new Campaign.
  const candidates = [
    Number(registered?.globalModelVersion ?? registered?.version),
    Number(metric?.gl_model_v),
  ]
    .filter((value) => Number.isInteger(value) && value >= 0);
  return candidates.length ? Math.max(...candidates) : 0;
};

const beginCampaignRun = async (task, releaseId, campaign) => {
  const baseGlobalModelVersion = await latestCompletedGlobalModelVersion(task);
  const targetGlobalModelVersion = baseGlobalModelVersion + 1;
  const runId = randomUUID();
  const startedAt = new Date();
  const run = await CampaignRun.create({
    runId,
    taskId: task._id,
    runtimeKey: task.runtimeKey || task.title,
    releaseId,
    status: 'starting',
    campaign,
    baseGlobalModelVersion,
    targetGlobalModelVersion,
    startedAt,
  });
  try {
    await axios.post(
      `${FL_SERVER_MANAGER_URL}/FLSe/BeginCampaign/${encodeURIComponent(task.runtimeKey || task.title)}`,
      {
        runId,
        releaseId,
        baseGlobalModelVersion,
        targetGlobalModelVersion,
        campaign,
      },
      { timeout: 5000 },
    );
    await Promise.all([
      CampaignRun.updateOne({ _id: run._id }, { $set: { status: 'running' } }),
      Task.updateOne({ _id: task._id }, { $set: { currentCampaignRunId: runId } }),
    ]);
    return {
      runId,
      releaseId,
      status: 'running',
      campaign,
      baseGlobalModelVersion,
      targetGlobalModelVersion,
      startedAt: startedAt.toISOString(),
    };
  } catch (error) {
    await CampaignRun.updateOne(
      { _id: run._id },
      { $set: { status: 'failed', endedAt: new Date(), failure: upstreamErrorMessage(error) } },
    );
    throw error;
  }
};

const runtimeManagerPayload = async (task, requestedCampaign = null) => {
  const base = taskRuntimeManagerPayload(task);
  const contract = resolveTaskRuntimeContract(task);
  if (contract.name !== 'federated-task-v3') return base;
  if (task.registryStatus !== 'published' || !task.currentPublishedReleaseId) {
    const error = new Error('Publish a Ready Task Release before creating a v3 aggregation server.');
    error.status = 409;
    throw error;
  }
  const release = await TaskRelease.findOne({
    taskId: task._id,
    releaseId: task.currentPublishedReleaseId,
    status: 'published',
  }).lean();
  if (!release) {
    const error = new Error('Published Task Release metadata is unavailable.');
    error.status = 409;
    throw error;
  }
  const model = await ModelVersion.findOne({
    _id: release.modelVersionId,
    taskId: task._id,
    status: 'ready',
  }).lean();
  if (!model) {
    const error = new Error('The Published Task Release has no Ready Initial Model.');
    error.status = 409;
    throw error;
  }
  const token = createRuntimeArtifactToken({
    taskId: task._id,
    releaseId: release.releaseId,
    modelVersionId: model._id,
  });
  const catalog = release.catalog || release.readiness?.registryCatalog || null;
  const supportedStrategies = catalog?.federation?.supportedStrategies || ['FedAvg'];
  const recommended = catalog?.federation?.recommendedCampaign || {};
  const fallback = task.campaignConfig || {
    rounds: recommended.rounds || Number(task.numRounds || 2),
    clientsPerRound: recommended.clients_per_round
      || recommended.clientsPerRound
      || Number(task.clientPerRound || 1),
    strategy: { name: recommended.strategy || task.strategy || supportedStrategies[0] },
  };
  const campaignConfig = normalizeCampaignConfig(
    connectValidationDataset(requestedCampaign || fallback, task.latestValidationData),
    supportedStrategies,
    fallback,
  );
  return {
    ...base,
    campaign_config: campaignConfig,
    runtime_release: {
      release_id: release.releaseId,
      archive_url: `${runtimeArtifactBaseUrl()}/${token}/archive`,
      archive_sha256: release.bundleSha256,
      model_url: `${runtimeArtifactBaseUrl()}/${token}/model`,
      model_sha256: model.checksum,
      model_format: model.format || 'safetensors',
      fedops_version: contract.fedopsVersion,
      source_revision: contract.sourceRevision,
    },
  };
};

// 관리 API는 Task가 public이어도 소유자/관리자에게만 허용한다.
// SBA-FL 모바일 모델 배포 API는 기존 디바이스 호환성을 위해 이번 단계에서
// 예외로 유지하고, 후속 단계에서 participant/device token으로 대체한다.
serverControl.param('taskId', async (taskId, ctx, next) => {
  const task = await Task.findBytitle(taskId);
  if (!task) {
    ctx.status = 404;
    ctx.body = { success: false, error: `Task with title ${taskId} not found` };
    return;
  }
  ctx.state.task = task;

  const isLegacySbaMobileRoute = ctx.path.includes('/sba-fl/mobile/');
  if (isLegacySbaMobileRoute && task.modelType === 'SBA-FL') {
    return next();
  }
  if (!ctx.state.user) {
    ctx.status = 401;
    ctx.body = { success: false, error: 'Authentication required.' };
    return;
  }
  if (!canManageTask(ctx.state.user, task)) {
    ctx.status = 403;
    ctx.body = { success: false, error: 'Only the task owner can manage this task.' };
    return;
  }
  return next();
});

serverControl.get('/campaign/:taskId', async (ctx) => {
  const task = ctx.state.task;
  let catalog = null;
  let release = null;
  if (task.currentPublishedReleaseId) {
    release = await TaskRelease.findOne({
      taskId: task._id,
      releaseId: task.currentPublishedReleaseId,
      status: 'published',
    }).lean();
    catalog = release?.catalog || release?.readiness?.registryCatalog || null;
  }
  const supportedStrategies = catalog?.federation?.supportedStrategies
    || [task.strategy || 'FedAvg'];
  const recommended = catalog?.federation?.recommendedCampaign || {};
  const campaign = normalizeCampaignConfig(
    task.campaignConfig || {
      rounds: recommended.rounds || Number(task.numRounds || 2),
      clientsPerRound: recommended.clients_per_round
        || recommended.clientsPerRound
        || Number(task.clientPerRound || 1),
      strategy: recommended.strategy || task.strategy || supportedStrategies[0],
    },
    supportedStrategies,
  );
  const contract = resolveTaskRuntimeContract(task);
  const evaluationDefaults = campaign.serverEvaluation === undefined
    ? await readReleaseEvaluation(task, release, contract)
    : { supported: supportsEvaluationOverride(contract), enabled: campaign.serverEvaluation.enabled,
      ...(!supportsEvaluationOverride(contract) && { reason: 'Publish a compatible Release to change Validation ON/OFF.' }) };
  ctx.body = {
    campaign,
    evaluationDefaults,
    supportedStrategies,
    releaseId: task.currentPublishedReleaseId || null,
    immutableReleaseRequired: resolveTaskRuntimeContract(task).name === 'federated-task-v3',
    persisted: Boolean(task.campaignConfig?.updatedAt),
    savedAt: task.campaignConfig?.updatedAt || null,
    latestValidationData: task.latestValidationData || null,
  };
});

serverControl.put('/campaign/:taskId', async (ctx) => {
  try {
    const task = ctx.state.task;
    const runtimeContract = resolveTaskRuntimeContract(task);
    if (runtimeContract.name !== 'federated-task-v3') {
      ctx.status = 409;
      ctx.body = { success: false, error: 'Campaign settings are only stored for FedOps 1.3 Tasks.' };
      return;
    }
    const requestedCampaign = ctx.request.body?.campaignConfig || ctx.request.body;
    const runtimePayload = await runtimeManagerPayload(task, requestedCampaign);
    const savedAt = new Date();
    const campaign = {
      ...runtimePayload.campaign_config,
      updatedAt: savedAt,
    };
    await Task.updateOne(
      { _id: task._id },
      { $set: { campaignConfig: campaign } },
    );
    ctx.body = {
      success: true,
      message: 'Federated campaign saved.',
      campaign: runtimePayload.campaign_config,
      releaseId: task.currentPublishedReleaseId || null,
      persisted: true,
      savedAt: savedAt.toISOString(),
    };
  } catch (error) {
    ctx.status = error.status || 400;
    ctx.body = { success: false, error: error.message };
  }
});

// Owner authorization is enforced by the existing serverControl middleware.
serverControl.get('/validation-data/:taskId', async (ctx) => {
  try {
    if (resolveTaskRuntimeContract(ctx.state.task).name !== 'federated-task-v3') ctx.throw(409, 'Validation data requires a FedOps 1.3 Task.');
    const response = await axios.get(`${FL_SERVER_MANAGER_URL}/web-control/validation-data/${encodeURIComponent(ctx.params.taskId)}`, { timeout: 30000 });
    ctx.body = { ...response.data, latestValidationData: ctx.state.task.latestValidationData || null };
  } catch (error) {
    ctx.status = error.status || error.response?.status || 503;
    ctx.body = { success: false, error: upstreamErrorMessage(error) };
  }
});

serverControl.post('/validation-data/:taskId', async (ctx) => {
  let source;
  try {
    if (resolveTaskRuntimeContract(ctx.state.task).name !== 'federated-task-v3') ctx.throw(409, 'Validation data requires a FedOps 1.3 Task.');
    let headers;
    try { headers = validationHeaders(ctx.headers); } catch (error) { ctx.throw(422, error.message); }
    source = boundedValidationStream(Number(headers['content-length']));
    ctx.req.on('aborted', () => source.destroy(new Error('Validation upload disconnected.')));
    ctx.req.on('error', (error) => source.destroy(error));
    const pending = axios.post(`${FL_SERVER_MANAGER_URL}/web-control/validation-data/${encodeURIComponent(ctx.params.taskId)}`, source,
      { headers, timeout: 360000, maxBodyLength: 520 * 1024 * 1024 });
    ctx.req.pipe(source);
    const uploaded = (await pending).data;
    if (!uploaded.success || !/^validation-[a-f0-9]{64}$/.test(uploaded.dataPath || '')
        || uploaded.sha256 !== headers['x-fedops-sha256']) ctx.throw(502, 'Invalid validation upload receipt.');
    await Task.updateOne({ _id: ctx.state.task._id }, { $set: { latestValidationData: {
      dataPath: uploaded.dataPath, sha256: uploaded.sha256,
      fileCount: uploaded.fileCount, totalBytes: uploaded.totalBytes, uploadedAt: new Date(),
    } } });
    ctx.body = uploaded;
  } catch (error) {
    ctx.status = error.status || error.response?.status || 503;
    ctx.body = { success: false, error: upstreamErrorMessage(error) };
  } finally {
    if (source) { ctx.req.unpipe(source); source.destroy(); }
  }
});

serverControl.post('/validation-check/:taskId', async (ctx) => {
  try {
    const task = ctx.state.task;
    if (resolveTaskRuntimeContract(task).name !== 'federated-task-v3') {
      ctx.throw(409, 'Validation settings require a compatible FedOps 1.3 Release.');
    }
    const payload = await runtimeManagerPayload(task, ctx.request.body?.campaignConfig);
    const result = await checkCampaignValidation(ctx.params.taskId, payload.campaign_config);
    ctx.body = result;
  } catch (error) {
    ctx.status = error.status || 400;
    ctx.body = { success: false, error: upstreamErrorMessage(error) };
  }
});

const loadSbaFlTask = async (ctx, taskId) => {
  const task = await Task.findOne({ title: taskId }).lean();
  if (!task) {
    ctx.status = 404;
    ctx.body = { success: false, error: `Task with title ${taskId} not found` };
    return null;
  }

  if (task.modelType !== 'SBA-FL') {
    ctx.status = 403;
    ctx.body = { success: false, error: 'SBA-FL model access is only available for SBA-FL tasks.' };
    return null;
  }

  return task;
};

const loadSbaFlAdminTask = async (ctx, taskId) => {
  if (!isAdminUser(ctx)) {
    ctx.status = 403;
    ctx.body = { success: false, error: 'SBA-FL management is only allowed for admin.' };
    return null;
  }

  return loadSbaFlTask(ctx, taskId);
};

const executeInTaskPod = async (taskId, command) => {
  const response = await axios.post(
    `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
    { command }
  );
  return response.data;
};

const checkCampaignValidation = async (taskId, campaign) => {
  const result = await executeInTaskPod(taskId, validationCheckCommand(campaign));
  const line = String(result.output || '').split('\n')
    .find((entry) => entry.startsWith('FEDOPS_VALIDATION_RESULT='));
  if (!line) throw new Error('Validation check unavailable. Prepare the server and update to an optional-validation Runtime/Release.');
  const checked = JSON.parse(line.slice('FEDOPS_VALIDATION_RESULT='.length));
  if (!checked.success || checked.status === 'error') throw new Error(checked.error || 'Validation check failed.');
  return checked;
};

// eslint-disable-next-line no-control-regex
const stripAnsi = (value = '') => value.replace(/\u001b\[[0-9;]*m/g, '');

const parseJsonValueFromCommandOutput = (rawOutput = '', expectedType = 'object') => {
  const text = stripAnsi(rawOutput).trim();
  const isExpected = (value) => {
    if (expectedType === 'array') return Array.isArray(value);
    if (expectedType === 'object') return value && typeof value === 'object' && !Array.isArray(value);
    return true;
  };

  try {
    const parsed = JSON.parse(text);
    if (isExpected(parsed)) return parsed;
  } catch (error) {
    // Fall through and try to extract the JSON payload from wrapped command output.
  }

  const startChar = expectedType === 'array' ? '[' : '{';
  const endChar = expectedType === 'array' ? ']' : '}';
  const starts = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === startChar) starts.push(index);
  }

  for (const start of starts) {
    let end = text.lastIndexOf(endChar);
    while (end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (isExpected(parsed)) return parsed;
      } catch (error) {
        try {
          const pythonReprAsJson = candidate
            .replace(/\bNone\b/g, 'null')
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/'/g, '"');
          const parsed = JSON.parse(pythonReprAsJson);
          if (isExpected(parsed)) return parsed;
        } catch (nestedError) {
          // Try a shorter candidate.
        }
      }
      end = text.lastIndexOf(endChar, end - 1);
    }
  }

  return null;
};

const parseSbaFlLogTimestampMs = (line = '') => {
  const match = String(line).match(/^\[(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})\]/);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    Number(match[7])
  );
};

const toIsoFromEpochMs = (value) => {
  if (!Number.isFinite(value)) return null;
  return new Date(value).toISOString();
};

const parseSbaFlHistory = (rawLog = '') => {
  const text = stripAnsi(rawLog);
  const roundMap = new Map();
  const summary = {
    finished: false,
    totalRounds: null,
    durationSeconds: null,
    globalModelSaved: false,
    latestModelPath: null,
    startedAtEpochMs: null,
    startedAtIso: null,
    finishedAtEpochMs: null,
    finishedAtIso: null,
  };

  const ensureRound = (round) => {
    const key = Number(round);
    if (!roundMap.has(key)) {
      roundMap.set(key, {
        round: key,
        fitResults: null,
        fitFailures: null,
        evaluateResults: null,
        evaluateFailures: null,
        distributedLoss: null,
        modelPath: null,
      });
    }
    return roundMap.get(key);
  };

  let currentRound = null;
  text.split(/\r?\n/).forEach((line) => {
    const lineTimestampMs = parseSbaFlLogTimestampMs(line);
    if (
      lineTimestampMs != null &&
      summary.startedAtEpochMs == null &&
      /FL Mobile Server Start|Starting Flower server|Starting Flower/i.test(line)
    ) {
      summary.startedAtEpochMs = lineTimestampMs;
      summary.startedAtIso = toIsoFromEpochMs(lineTimestampMs);
    }

    const roundMatch = line.match(/\[ROUND\s+(\d+)\]/);
    if (roundMatch) {
      currentRound = Number(roundMatch[1]);
      ensureRound(currentRound);
    }

    const fitMatch = line.match(/aggregate_fit:\s+received\s+(\d+)\s+results\s+and\s+(\d+)\s+failures/);
    if (fitMatch && currentRound) {
      const round = ensureRound(currentRound);
      round.fitResults = Number(fitMatch[1]);
      round.fitFailures = Number(fitMatch[2]);
    }

    const evalMatch = line.match(/aggregate_evaluate:\s+received\s+(\d+)\s+results\s+and\s+(\d+)\s+failures/);
    if (evalMatch && currentRound) {
      const round = ensureRound(currentRound);
      round.evaluateResults = Number(evalMatch[1]);
      round.evaluateFailures = Number(evalMatch[2]);
    }

    const lossMatch = line.match(/round\s+(\d+):\s+([0-9Ee+\-.]+)/);
    if (lossMatch) {
      ensureRound(lossMatch[1]).distributedLoss = Number(lossMatch[2]);
    }

    const savedMatch = line.match(/SBA_FL_GLOBAL_MODEL_SAVED\s+round=(\d+)\s+path=([^\s]+)\s+tensor_count=(\d+)/);
    if (savedMatch) {
      const round = ensureRound(savedMatch[1]);
      round.modelPath = savedMatch[2];
      summary.globalModelSaved = true;
      summary.latestModelPath = savedMatch[2];
    }

    const finishedMatch = line.match(/Run finished\s+(\d+)\s+round\(s\)\s+in\s+([0-9Ee+\-.]+)s/);
    if (finishedMatch) {
      summary.finished = true;
      summary.totalRounds = Number(finishedMatch[1]);
      summary.durationSeconds = Number(finishedMatch[2]);
      if (lineTimestampMs != null) {
        summary.finishedAtEpochMs = lineTimestampMs;
        summary.finishedAtIso = toIsoFromEpochMs(lineTimestampMs);
      }
    }
  });

  return {
    summary,
    rounds: Array.from(roundMap.values()).sort((a, b) => a.round - b.round),
  };
};

const parseFileList = (rawJson = '') => {
  const parsed = parseJsonValueFromCommandOutput(rawJson, 'array');
  return Array.isArray(parsed) ? parsed : [];
};

const mergeSbaHistoryWithLogSummary = (history, logHistory) => {
  if (!history || typeof history !== 'object') return logHistory;
  if (!logHistory || typeof logHistory !== 'object') return history;

  const merged = {
    ...history,
    summary: {
      ...(history.summary || {}),
    },
  };

  if (logHistory.summary?.finished) merged.summary.finished = true;
  if (logHistory.summary?.totalRounds != null) merged.summary.totalRounds = logHistory.summary.totalRounds;
  if (logHistory.summary?.durationSeconds != null) merged.summary.durationSeconds = logHistory.summary.durationSeconds;
  if (logHistory.summary?.globalModelSaved) merged.summary.globalModelSaved = true;
  if (logHistory.summary?.latestModelPath) merged.summary.latestModelPath = logHistory.summary.latestModelPath;
  if (logHistory.summary?.startedAtEpochMs != null) merged.summary.startedAtEpochMs = logHistory.summary.startedAtEpochMs;
  if (logHistory.summary?.startedAtIso) merged.summary.startedAtIso = logHistory.summary.startedAtIso;
  if (logHistory.summary?.finishedAtEpochMs != null) merged.summary.finishedAtEpochMs = logHistory.summary.finishedAtEpochMs;
  if (logHistory.summary?.finishedAtIso) merged.summary.finishedAtIso = logHistory.summary.finishedAtIso;

  if ((!merged.rounds || merged.rounds.length === 0) && Array.isArray(logHistory.rounds)) {
    merged.rounds = logHistory.rounds;
  }

  return merged;
};

// ============= 서버 라이프사이클 관리 =============

// 스케일링 가능한 서버 생성
serverControl.post('/create-scalable/:taskId', guardRuntimeCreation, async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { serverRepoAddr = '' } = ctx.request.body;

    console.log(`Creating scalable server for task: ${taskId}`);

    // DB에서 task 정보 조회
    const task = await Task.findOne({ title: taskId }).lean();
    if (!task) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: `Task with title ${taskId} not found`
      };
      return;
    }
    const runtimePayload = await runtimeManagerPayload(task);

    // yamlConfig가 있으면 config와 함께 서버 생성, 없으면 기본 서버 생성
    if (task.yamlConfig) {
      console.log('YAML Config found in DB, creating server with config');
      
      // DB에서 조회한 FL 설정으로 요청 데이터 구성
      const flRequestData = {
        task_id: taskId,
        devices: [], // 초기에는 빈 디바이스 배열
        server_repo_addr: serverRepoAddr || task.serverRepoAddr || '',
        yaml_config: task.yamlConfig, // DB에서 조회한 YAML 설정
        // 추가 FL 설정 파라미터들
        data_type: task.dataType || '',
        model_type: task.modelType || '',
        learning_rate: task.learningRate || '',
        num_epochs: task.numEpochs || '',
        batch_size: task.batchSize || '',
        num_rounds: task.numRounds || '',
        client_per_round: task.clientPerRound || '',
        strategy: task.strategy || '',
        strategy_params: task.strategyParams || null,
        xai_enabled: task.xaiEnabled || '',
        llm_params: task.llmParams || null,
        dataset_params: {
          ...(task.datasetParams || {}),
          sbaFlTarget: task.sbaFlTarget || task.datasetParams?.sbaFlTarget || ''
        },
        sba_fl_target: task.sbaFlTarget || task.datasetParams?.sbaFlTarget || '',
        ...runtimePayload,
      };

      console.log('FL Request prepared:', JSON.stringify({
        ...flRequestData,
        runtime_release: flRequestData.runtime_release
          ? { ...flRequestData.runtime_release, archive_url: '[signed]', model_url: '[signed]' }
          : undefined,
      }, null, 2));
      console.log('YAML Config from DB:');
      console.log('='.repeat(50));
      console.log(task.yamlConfig);
      console.log('='.repeat(50));

      const response = await axios.post(
        `${FL_SERVER_MANAGER_URL}/web-control/create-scalable-server-with-config/${taskId}`,
        flRequestData
      );

      ctx.body = {
        success: true,
        message: response.data.message,
        config_applied: response.data.config_applied,
        yaml_saved: response.data.yaml_saved,
        taskId,
        yamlConfigIncluded: true
      };
    } else if (runtimePayload.runtime_release) {
      const response = await axios.post(
        `${FL_SERVER_MANAGER_URL}/web-control/create-scalable-server-with-config/${taskId}`,
        {
          task_id: taskId,
          devices: [],
          server_repo_addr: '',
          data_type: task.dataType || '',
          model_type: task.modelType || '',
          learning_rate: task.learningRate || '',
          num_epochs: task.numEpochs || '',
          batch_size: task.batchSize || '',
          num_rounds: task.numRounds || '',
          client_per_round: task.clientPerRound || '',
          strategy: task.strategy || '',
          ...runtimePayload,
        },
      );
      ctx.body = {
        success: true,
        message: response.data.message,
        taskId,
        releaseId: runtimePayload.runtime_release.release_id,
        yamlConfigIncluded: false,
      };
    } else {
      console.log('No YAML Config found in DB, creating basic server');
      
      const response = await axios.post(
        `${FL_SERVER_MANAGER_URL}/web-control/create-scalable-server/${taskId}`,
        null,
        {
          params: {
            server_repo_addr: serverRepoAddr,
            ...runtimePayload,
          },
        }
      );

      ctx.body = {
        success: true,
        message: response.data.message,
        taskId,
        yamlConfigIncluded: false
      };
    }
  } catch (error) {
    console.error('Error creating scalable server:', error.response?.data || error.message);
    ctx.status = error.response?.status || error.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// FL Config를 포함한 스케일링 가능한 서버 생성
serverControl.post('/create-scalable-with-config/:taskId', guardRuntimeCreation, async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await Task.findOne({ title: taskId }).lean();
    if (!task) {
      ctx.status = 404;
      ctx.body = { success: false, error: `Task with title ${taskId} not found` };
      return;
    }
    const runtimePayload = await runtimeManagerPayload(task);
    const flConfig = {
      ...ctx.request.body,
      ...runtimePayload,
    };

    console.log(`Creating scalable server with FL config for task: ${taskId}`);
    console.log('FL Config prepared:', JSON.stringify({
      ...flConfig,
      runtime_release: flConfig.runtime_release
        ? { ...flConfig.runtime_release, archive_url: '[signed]', model_url: '[signed]' }
        : undefined,
    }, null, 2));

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/create-scalable-server-with-config/${taskId}`,
      flConfig
    );

    ctx.body = {
      success: true,
      message: response.data.message,
      config_applied: response.data.config_applied,
      yaml_saved: response.data.yaml_saved,
      taskId
    };
  } catch (error) {
    console.error('Error creating scalable server with config:', error.response?.data || error.message);
    ctx.status = error.response?.status || error.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 저장된 설정으로 스케일링 가능한 서버 생성
serverControl.post('/create-scalable-from-saved/:taskId', guardRuntimeCreation, async (ctx) => {
  try {
    const { taskId } = ctx.params;

    console.log(`Creating scalable server from saved config for task: ${taskId}`);

    // DB에서 task 정보 조회
    const task = await Task.findOne({ title: taskId }).lean();
    if (!task) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: `Task with title ${taskId} not found`
      };
      return;
    }
    // Container preparation uses saved/default policy in either ON or OFF.
    // It must not persist an unchecked Campaign or the browser's unsaved draft.
    const runtimePayload = await runtimeManagerPayload(task);
    const managerCampaign = serverManagerCampaignFields(runtimePayload.campaign_config, task);

    // DB에서 조회한 FL 설정으로 요청 데이터 구성
    const flRequestData = {
      task_id: taskId,
      devices: [], // 초기에는 빈 디바이스 배열
      server_repo_addr: task.serverRepoAddr || '',
      yaml_config: task.yamlConfig || '', // DB에서 조회한 YAML 설정
      // 추가 FL 설정 파라미터들
      data_type: task.dataType || '',
      model_type: task.modelType || '',
      learning_rate: task.learningRate || '',
      num_epochs: task.numEpochs || '',
      batch_size: task.batchSize || '',
      ...managerCampaign,
      strategy_params: task.strategyParams || null,
      xai_enabled: task.xaiEnabled || '',
      xai_params: task.xaiParams || null,
      llm_params: task.llmParams || null,
      dataset_params: task.datasetParams || null,
      ...runtimePayload,
    };

    console.log('Saved FL Request prepared:', JSON.stringify({
      ...flRequestData,
      runtime_release: flRequestData.runtime_release
        ? { ...flRequestData.runtime_release, archive_url: '[signed]', model_url: '[signed]' }
        : undefined,
    }, null, 2));
    
    // yamlConfig가 있는지 확인하고 로그 출력
    if (task.yamlConfig) {
      console.log('YAML Config found in DB:');
      console.log('='.repeat(50));
      console.log(task.yamlConfig);
      console.log('='.repeat(50));
    } else {
      console.log('No YAML Config found in DB for task:', taskId);
    }

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/create-scalable-server-with-config/${taskId}`,
      flRequestData
    );

    ctx.body = {
      success: true,
      message: response.data.message,
      config_applied: response.data.config_applied,
      yaml_saved: response.data.yaml_saved,
      taskId,
      yamlConfigIncluded: !!task.yamlConfig
    };
  } catch (error) {
    console.error('Error creating scalable server from saved config:', error.response?.data || error.message);
    ctx.status = error.response?.status || error.status || 500;
    ctx.body = {
      success: false,
      error: upstreamErrorMessage(error)
    };
  }
});

// 서버 일시정지
serverControl.post('/pause/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/pause/${taskId}`
    );

    ctx.body = {
      success: true,
      message: response.data.message,
      taskId
    };
  } catch (error) {
    console.error('Error pausing server:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 서버 재개
serverControl.post('/resume/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/resume/${taskId}`
    );

    ctx.body = {
      success: true,
      message: response.data.message,
      taskId
    };
  } catch (error) {
    console.error('Error resuming server:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ============= 리소스 스케일링 =============

// 리소스 스케일링
serverControl.post('/scale/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { cpu, memory } = ctx.request.body;

    if (!cpu || !memory) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'CPU and memory are required'
      };
      return;
    }

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/scale-resources/${taskId}`,
      { cpu, memory }
    );

    ctx.body = {
      success: true,
      message: response.data.message,
      resources: { cpu, memory },
      taskId
    };
  } catch (error) {
    console.error('Error scaling resources:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ============= 서버 상태 및 모니터링 =============

// 서버 상태 조회
serverControl.get('/status/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;

    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/web-control/status/${taskId}`
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error getting server status:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 서버 로그 조회
serverControl.get('/logs/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { lines = 100 } = ctx.query;

    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/web-control/logs/${taskId}`,
      { params: { lines } }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error getting logs:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 서버 준비 상태 확인 (scalable server 전용)
serverControl.get('/check-server-ready/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;

    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/FLSe/CheckServerReady/${taskId}`
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error checking server ready status:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// FL 서버 연결 정보 조회
serverControl.get('/connection-info/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;

    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/FLSe/getConnectionInfo/${taskId}`
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error getting connection info:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ============= 명령 실행 =============

// 컨테이너 명령 실행
serverControl.post('/execute/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { command } = ctx.request.body;

    if (!command) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'Command is required'
      };
      return;
    }

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
      { command }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId,
      command
    };
  } catch (error) {
    console.error('Error executing command:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ============= 파일 관리 =============

// 파일 목록 조회
serverControl.get('/files/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { path = '/app/data' } = ctx.query;

    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/web-control/files/${taskId}`,
      { params: { path } }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId,
      path
    };
  } catch (error) {
    console.error('Error listing files:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 파일 내용 조회
serverControl.get('/file-content/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { filePath } = ctx.query;

    if (!filePath) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'File path is required'
      };
      return;
    }

    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/web-control/file-content/${taskId}`,
      { params: { file_path: filePath } }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId,
      filePath
    };
  } catch (error) {
    console.error('Error getting file content:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 파일 저장
serverControl.post('/save-file/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { filePath, content } = ctx.request.body;

    if (!filePath || content === undefined) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'File path and content are required'
      };
      return;
    }

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/save-file/${taskId}`,
      { file_path: filePath, content }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId,
      filePath
    };
  } catch (error) {
    console.error('Error saving file:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ============= 직접 컨테이너 API 호출 =============

// FL 서버에 직접 API 호출 (서버가 실행 중일 때)
serverControl.post('/fl-api/:taskId', async (ctx) => {
  const { taskId } = ctx.params;
  try {
    const { endpoint, method = 'GET', data = null } = ctx.request.body;

    // 먼저 서버 상태 확인하여 포트 가져오기
    const statusResponse = await axios.get(
      `${FL_SERVER_MANAGER_URL}/web-control/status/${taskId}`
    );

    const port = statusResponse.data.fl_server_status?.port;
    if (!port) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: 'FL server port not found. Server may not be running.'
      };
      return;
    }

    // 외부 IP 또는 서비스 URL 구성
    const serviceUrl = `http://fedops.svc.cluster.local:${port}`;
    
    let response;
    if (method.toLowerCase() === 'post') {
      response = await axios.post(`${serviceUrl}${endpoint}`, data);
    } else {
      response = await axios.get(`${serviceUrl}${endpoint}`);
    }

    ctx.body = {
      success: true,
      data: response.data,
      taskId,
      endpoint,
      method
    };
  } catch (error) {
    console.error('Error calling FL API:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data || error.message
    };
  }
});

// ============= 사전 정의된 명령어들 =============

// FL 서버 시작
serverControl.post('/start-fl-server/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = ctx.state.task;
    const runtimeContract = resolveTaskRuntimeContract(task);
    const runtimePayload = runtimeContract.name === 'federated-task-v3'
      ? await runtimeManagerPayload(task)
      : null;
    const campaign = runtimePayload?.campaign_config || null;
    // Recheck on every start, before creating a CampaignRun. A prior UI result
    // is not an authorization or a guarantee that files have not changed.
    if (campaign?.serverEvaluation) await checkCampaignValidation(taskId, campaign);
    const campaignRun = runtimeContract.name === 'federated-task-v3'
      ? await beginCampaignRun(task, runtimePayload.runtime_release.release_id, campaign)
      : null;
    const startCommand = aggregationServerStartCommand(runtimeContract, campaign, campaignRun);
    let response;
    try {
      response = await axios.post(
        `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
        { command: startCommand }
      );
      assertAggregationStarted(runtimeContract, response.data);
    } catch (error) {
      if (campaignRun) {
        await CampaignRun.updateOne(
          { runId: campaignRun.runId },
          { $set: { status: 'failed', endedAt: new Date(), failure: upstreamErrorMessage(error) } },
        );
      }
      throw error;
    }

    ctx.body = {
      success: true,
      message: 'FL Server start command executed',
      data: response.data,
      taskId,
      campaign,
      campaignRun,
    };
  } catch (error) {
    console.error('Error starting FL server:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// FL 서버 중지
serverControl.post('/stop-fl-server/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const runtimeContract = resolveTaskRuntimeContract(ctx.state.task);
    const runId = runtimeContract.name === 'federated-task-v3'
      ? ctx.state.task.currentCampaignRunId : null;
    let stopState = null;
    if (runId) {
      // Record intent before killing the process: its finally callback must not
      // turn an interrupted Campaign into a successful one.
      const intent = await axios.post(`${FL_SERVER_MANAGER_URL}/FLSe/EndCampaign/${encodeURIComponent(taskId)}`,
        { runId, phase: 'request' }, { timeout: 5000 });
      stopState = intent.data?.Server_Status;
    }
    const stopCommand = aggregationServerStopCommand(runtimeContract);
    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
      { command: stopCommand }
    );
    if (runId) {
      await axios.post(`${FL_SERVER_MANAGER_URL}/FLSe/EndCampaign/${encodeURIComponent(taskId)}`,
        { runId, phase: 'finished' }, { timeout: 5000 });
    }
    if (runtimeContract.name === 'federated-task-v3' && ctx.state.task.currentCampaignRunId) {
      await CampaignRun.updateOne(
        {
          taskId: ctx.state.task._id,
          runId: ctx.state.task.currentCampaignRunId,
          status: { $in: ['starting', 'running'] },
        },
        { $set: stopState?.Campaign_status === 'completed'
          ? { status: 'completed', endedAt: new Date(stopState.Campaign_ended_at) }
          : { status: 'stopped', endedAt: new Date() } },
      );
    }

    ctx.body = {
      success: true,
      message: 'FL Server stop command executed',
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error stopping FL server:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 프로세스 상태 확인
serverControl.get('/processes/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    
    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
      { command: 'ps aux | grep -E "(python|server_main)" | grep -v grep' }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error checking processes:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// FL 서버 상태 확인
serverControl.get('/fl-server-status/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    
    // FL 서버 프로세스 확인
    const processResponse = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
      { command: 'ps aux | grep -E "(server_main|main.py)" | grep -v grep' }
    );

    // 포트 8080에서 리스닝 중인지 확인
    const portResponse = await axios.post(
      `${FL_SERVER_MANAGER_URL}/web-control/execute-command/${taskId}`,
      { command: 'netstat -tulpn | grep :8080 || ss -tulpn | grep :8080' }
    );

    ctx.body = {
      success: true,
      message: 'FL Server status checked',
      data: {
        processes: processResponse.data,
        ports: portResponse.data
      },
      taskId
    };
  } catch (error) {
    console.error('Error checking FL server status:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// FL 서버 직접 API 호출
serverControl.post('/fl-api/:taskId', async (ctx) => {
  const { taskId } = ctx.params;
  try {
    const { endpoint, method = 'GET', data = null } = ctx.request.body;

    // 먼저 FL 서버의 연결 정보 가져오기
    const connectionInfo = await axios.get(
      `${FL_SERVER_MANAGER_URL}/FLSe/getConnectionInfo/${taskId}`
    );

    if (!connectionInfo.data.external_ip || !connectionInfo.data.port) {
      throw new Error('FL Server connection information not available');
    }

    const flServerUrl = `http://${connectionInfo.data.external_ip}:${connectionInfo.data.port}`;
    
    // FL 서버에 직접 API 호출
    const config = {
      method: method.toLowerCase(),
      url: `${flServerUrl}${endpoint}`,
      timeout: 10000
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      config.data = data;
    }

    const response = await axios(config);

    ctx.body = {
      success: true,
      data: response.data,
      taskId,
      fl_server_url: flServerUrl
    };
  } catch (error) {
    console.error('Error calling FL server API:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message,
      taskId
    };
  }
});

// ============= 기존 방식 호환 클라이언트 관리 =============

// 사용 가능한 클라이언트 목록 조회
serverControl.get('/clients/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    
    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/FLSe/GetAvailableClients/${taskId}`
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error getting available clients:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 선택된 클라이언트들과 FL 시작
serverControl.post('/start-fl-with-clients/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const requestData = ctx.request.body;

    console.log(`Starting FL with selected clients for task: ${taskId}`);
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/FLSe/StartFLWithSelectedClients/${taskId}`,
      requestData
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error starting FL with clients:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 태스크 요약 정보 조회
serverControl.get('/task-summary/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    
    const response = await axios.get(
      `${FL_SERVER_MANAGER_URL}/FLSe/GetTaskSummary/${taskId}`
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error getting task summary:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ============= SBA-FL 전용 관리 API =============

serverControl.get('/sba-fl/status/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await loadSbaFlAdminTask(ctx, taskId);
    if (!task) return;

    const [statusResult, connectionResult, readyResult, clientsResult] = await Promise.allSettled([
      axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/status/${taskId}`),
      axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/getConnectionInfo/${taskId}`),
      axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/CheckServerReady/${taskId}`),
      axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/GetAvailableClients/${taskId}`),
    ]);
    const infoResult = await axios.get(`${FL_SERVER_MANAGER_URL}/FLSe/info/${taskId}/android-client`).catch(() => null);

    const processResult = await executeInTaskPod(
      taskId,
      'ps aux | grep -E "(server_main|python3)" | grep -v grep || true'
    );

    ctx.body = {
      success: true,
      taskId,
      taskConfig: {
        title: task.title,
        modelType: task.modelType,
        sbaFlTarget: task.sbaFlTarget || task.datasetParams?.sbaFlTarget || '',
        clientPerRound: task.clientPerRound || '',
        numRounds: task.numRounds || '',
        numEpochs: task.numEpochs || '',
      },
      managerStatus: statusResult.status === 'fulfilled' ? statusResult.value.data : null,
      connectionInfo: connectionResult.status === 'fulfilled' ? connectionResult.value.data : null,
      readyStatus: readyResult.status === 'fulfilled' ? readyResult.value.data : null,
      infoStatus: infoResult?.data || null,
      availableClients: clientsResult.status === 'fulfilled' ? clientsResult.value.data : null,
      processOutput: processResult.output || '',
    };
  } catch (error) {
    console.error('Error getting SBA-FL status:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

serverControl.get('/sba-fl/history/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await loadSbaFlAdminTask(ctx, taskId);
    if (!task) return;

    const command = [
      'if [ -f /app/data/logs/sba_fl_history.json ]; then',
      '  cat /app/data/logs/sba_fl_history.json;',
      '  printf "\\n__SBA_FL_SERVERLOG__\\n";',
      '  tail -300 /app/data/logs/serverlog.txt 2>/dev/null || true;',
      'else',
      '  tail -300 /app/data/logs/serverlog.txt 2>/dev/null || true;',
      'fi'
    ].join(' ');
    const result = await executeInTaskPod(taskId, command);
    const output = result.output || '';

    const parsedFromFile = parseJsonValueFromCommandOutput(output, 'object');
    const parsedFromLog = parseSbaFlHistory(output);
    const parsed = parsedFromFile
      ? mergeSbaHistoryWithLogSummary(parsedFromFile, parsedFromLog)
      : parsedFromLog;

    ctx.body = {
      success: true,
      taskId,
      data: parsed,
      rawLogPreview: output.slice(-4000),
    };
  } catch (error) {
    console.error('Error getting SBA-FL history:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

serverControl.get('/sba-fl/models/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await loadSbaFlAdminTask(ctx, taskId);
    if (!task) return;

    const command = `python3 - <<'PY'
import datetime
import json
import os
import re

root = '/app/data/models'
items = []
if os.path.isdir(root):
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        stat = os.stat(path)
        modified_ms = int(stat.st_mtime * 1000)
        metadata = {}
        if name.endswith('.json'):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict):
                    metadata = loaded
            except Exception:
                metadata = {}

        versioned_latest_match = re.match(r'global_model_latest_v(\\d+)\\.json$', name)
        snapshot_match = None
        if name != 'global_model_latest.json' and not versioned_latest_match:
            snapshot_match = re.match(r'global_model_(.+)_round_(\\d+)\\.json$', name)
        round_match = re.match(r'global_model_round_(\\d+)\\.json$', name)
        artifact_type = (
            'latest' if name == 'global_model_latest.json'
            else ('versionedLatest' if versioned_latest_match else ('runSnapshot' if snapshot_match else 'round'))
        )
        file_round = None
        if snapshot_match:
            file_round = int(snapshot_match.group(2))
        elif round_match:
            file_round = int(round_match.group(1))
        version_number = None
        if versioned_latest_match:
            version_number = int(versioned_latest_match.group(1))

        items.append({
            'name': name,
            'path': path,
            'sizeBytes': stat.st_size,
            'modifiedEpochMs': modified_ms,
            'modifiedIso': datetime.datetime.fromtimestamp(
                stat.st_mtime,
                datetime.timezone.utc
            ).isoformat(),
            'artifactType': artifact_type,
            'round': metadata.get('round') if metadata.get('round') is not None else file_round,
            'globalModelVersion': metadata.get('globalModelVersion') or (f"v{version_number}" if version_number is not None else None),
            'globalModelVersionNumber': metadata.get('globalModelVersionNumber') or version_number,
            'runId': metadata.get('runId') or (snapshot_match.group(1) if snapshot_match else None),
            'savedAtIso': metadata.get('savedAtIso'),
            'taskId': metadata.get('taskId'),
            'modelType': metadata.get('modelType'),
            'source': metadata.get('source'),
            'tensorCount': metadata.get('tensorCount'),
            'sequenceLength': metadata.get('sequenceLength'),
            'featureCount': metadata.get('featureCount'),
        })
items.sort(key=lambda item: (item.get('modifiedEpochMs') or 0, 1 if item.get('artifactType') == 'latest' else 0), reverse=True)
print(json.dumps(items))
PY`;

    const result = await executeInTaskPod(taskId, command);
    const files = parseFileList(result.output || '').map((file) => ({
      ...file,
      url: `/fedops/api/server-control/sba-fl/model/${encodeURIComponent(taskId)}/${encodeURIComponent(file.name)}`
    }));

    ctx.body = {
      success: true,
      taskId,
      models: files,
    };
  } catch (error) {
    console.error('Error listing SBA-FL models:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

serverControl.get('/sba-fl/model/:taskId/:fileName', async (ctx) => {
  try {
    const { taskId, fileName } = ctx.params;
    const task = await loadSbaFlAdminTask(ctx, taskId);
    if (!task) return;

    const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeFileName) {
      ctx.status = 400;
      ctx.body = { success: false, error: 'Invalid file name' };
      return;
    }

    const command = `python3 - <<'PY'
import base64, os, sys
path = os.path.join('/app/data/models', ${JSON.stringify(safeFileName)})
if not os.path.isfile(path):
    sys.exit(2)
with open(path, 'rb') as f:
    print(base64.b64encode(f.read()).decode('ascii'))
PY`;
    const result = await executeInTaskPod(taskId, command);
    const content = Buffer.from((result.output || '').trim(), 'base64');

    ctx.set('Content-Type', safeFileName.endsWith('.json') ? 'application/json' : 'application/octet-stream');
    ctx.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
    ctx.body = content;
  } catch (error) {
    console.error('Error downloading SBA-FL model:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

serverControl.get('/sba-fl/mobile/models/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await loadSbaFlTask(ctx, taskId);
    if (!task) return;

    const command = `python3 - <<'PY'
import datetime
import json
import os
import re

root = '/app/data/models'
items = []
if os.path.isdir(root):
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        stat = os.stat(path)
        metadata = {}
        if name.endswith('.json'):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict):
                    metadata = loaded
            except Exception:
                metadata = {}

        versioned_latest_match = re.match(r'global_model_latest_v(\\d+)\\.json$', name)
        if not versioned_latest_match:
            continue

        version_number = int(versioned_latest_match.group(1))
        items.append({
            'name': name,
            'sizeBytes': stat.st_size,
            'modifiedEpochMs': int(stat.st_mtime * 1000),
            'modifiedIso': datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).isoformat(),
            'artifactType': 'versionedLatest',
            'round': metadata.get('round'),
            'globalModelVersion': metadata.get('globalModelVersion') or f"v{version_number}",
            'globalModelVersionNumber': metadata.get('globalModelVersionNumber') or version_number,
            'runId': metadata.get('runId'),
            'savedAtIso': metadata.get('savedAtIso'),
            'taskId': metadata.get('taskId'),
            'modelType': metadata.get('modelType'),
            'source': metadata.get('source'),
            'tensorCount': metadata.get('tensorCount'),
            'sequenceLength': metadata.get('sequenceLength'),
            'featureCount': metadata.get('featureCount'),
        })
items.sort(key=lambda item: item.get('globalModelVersionNumber') or 0, reverse=True)
print(json.dumps(items))
PY`;

    const result = await executeInTaskPod(taskId, command);
    const files = parseFileList(result.output || '').map((file) => ({
      ...file,
      url: `/fedops/api/server-control/sba-fl/mobile/model/${encodeURIComponent(taskId)}/${encodeURIComponent(file.name)}`
    }));

    ctx.body = {
      success: true,
      taskId,
      models: files,
    };
  } catch (error) {
    console.error('Error listing mobile SBA-FL models:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

serverControl.get('/sba-fl/mobile/model/:taskId/:fileName', async (ctx) => {
  try {
    const { taskId, fileName } = ctx.params;
    const task = await loadSbaFlTask(ctx, taskId);
    if (!task) return;

    const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeFileName || !/^global_model_latest_v\d+\.json$/.test(safeFileName)) {
      ctx.status = 400;
      ctx.body = { success: false, error: 'Invalid SBA-FL global model file name' };
      return;
    }

    const command = `python3 - <<'PY'
import base64, os, sys
path = os.path.join('/app/data/models', ${JSON.stringify(safeFileName)})
if not os.path.isfile(path):
    sys.exit(2)
with open(path, 'rb') as f:
    print(base64.b64encode(f.read()).decode('ascii'))
PY`;
    const result = await executeInTaskPod(taskId, command);
    const content = Buffer.from((result.output || '').trim(), 'base64');

    ctx.set('Content-Type', 'application/json');
    ctx.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
    ctx.body = content;
  } catch (error) {
    console.error('Error downloading mobile SBA-FL model:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

serverControl.post('/sba-fl/config/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await loadSbaFlAdminTask(ctx, taskId);
    if (!task) return;

    const clientPerRound = String(ctx.request.body.clientPerRound || task.clientPerRound || '1');
    const numRounds = String(ctx.request.body.numRounds || task.numRounds || '2');
    const numEpochs = String(ctx.request.body.numEpochs || task.numEpochs || '3');

    await Task.updateOne(
      { title: taskId },
      {
        $set: {
          clientPerRound,
          numRounds,
          numEpochs,
        }
      }
    );

    const command = `python3 - <<'PY'
from pathlib import Path
path = Path('/app/code/conf/config.yaml')
text = path.read_text()
replacements = {
    'num_epochs:': 'num_epochs: ${numEpochs}',
    'num_rounds:': 'num_rounds: ${numRounds}',
    'clients_per_round:': 'clients_per_round: ${clientPerRound}',
}
lines = []
for line in text.splitlines():
    stripped = line.strip()
    replaced = False
    for prefix, new_line in replacements.items():
        if stripped.startswith(prefix):
            lines.append(new_line)
            replaced = True
            break
    if not replaced:
        lines.append(line)
path.write_text('\\n'.join(lines) + '\\n')
print(path.read_text())
PY`;

    const result = await executeInTaskPod(taskId, command);

    ctx.body = {
      success: true,
      taskId,
      config: { clientPerRound, numRounds, numEpochs },
      podConfigPreview: result.output || '',
      note: 'numEpochs is stored in the server fit_config and is applied by the updated Android weight FL client.'
    };
  } catch (error) {
    console.error('Error updating SBA-FL config:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 클러스터 할당
serverControl.put('/assign-cluster/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const assignmentData = ctx.request.body;

    const response = await axios.put(
      `${FL_SERVER_MANAGER_URL}/FLSe/cluster/${taskId}`,
      assignmentData
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error assigning cluster:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// 클러스터 일괄 할당
serverControl.post('/bulk-assign-cluster/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { assignments } = ctx.request.body;

    const response = await axios.post(
      `${FL_SERVER_MANAGER_URL}/FLSe/BulkAssignCluster/${taskId}`,
      { assignments }
    );

    ctx.body = {
      success: true,
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('Error bulk assigning clusters:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ========== 새로운 라우트 추가 (파일 끝부분, export 전) ==========

// 실시간 로그 스트리밍 (SSE)
serverControl.get('/stream-logs/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const { filePath = '/app/data/logs/serverlog.txt' } = ctx.query;

    console.log(`Starting log stream for task: ${taskId}, file: ${filePath}`);

    // SSE 헤더 설정
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // PassThrough 스트림 생성
    const stream = new PassThrough();
    ctx.body = stream;

    // FedOps-Server의 로그 스트리밍 엔드포인트 호출
    const response = await axios({
      method: 'get',
      url: `${FL_SERVER_MANAGER_URL}/web-control/stream-logs/${taskId}`,
      params: { file_path: filePath },
      responseType: 'stream',
      timeout: 0 // 타임아웃 없음 (스트리밍)
    });

    // FedOps-Server의 응답을 클라이언트로 파이프
    response.data.on('data', (chunk) => {
      stream.write(chunk);
    });

    response.data.on('end', () => {
      console.log(`Log stream ended for task: ${taskId}`);
      stream.end();
    });

    response.data.on('error', (error) => {
      console.error(`Error in log stream for task ${taskId}:`, error);
      stream.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      stream.end();
    });

    // 클라이언트 연결 종료 시 정리
    ctx.req.on('close', () => {
      console.log(`Client disconnected from log stream for task: ${taskId}`);
      response.data.destroy();
      stream.end();
    });

  } catch (error) {
    console.error('Error setting up log stream:', error.response?.data || error.message);
    ctx.status = error.response?.status || 500;
    ctx.body = {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
});

// ========== 기존 export 유지 ==========
export default serverControl;
