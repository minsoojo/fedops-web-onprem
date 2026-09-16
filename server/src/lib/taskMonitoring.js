import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { loadTaskActivity } from './taskActivity.js';

const DEFAULT_ROUND_LIMIT = 25;
const MAX_ROUND_LIMIT = 200;
const MAX_SYSTEM_POINTS = 240;

const asFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const objectIdTimestamp = (value) => {
  if (!value) return null;
  try {
    const objectId = value instanceof mongoose.Types.ObjectId
      ? value
      : new mongoose.Types.ObjectId(value);
    return objectId.getTimestamp().toISOString();
  } catch {
    return null;
  }
};

const normalizeTimestamp = (value, fallbackId = null) => {
  if (value !== null && value !== undefined && value !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      const milliseconds = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return objectIdTimestamp(fallbackId);
};

const latestTimestamp = (...values) => {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps.map((value) => value.getTime()))).toISOString();
};

const maskDeviceId = (value) => {
  const deviceId = String(value || '');
  if (deviceId.length <= 8) return deviceId || 'unknown';
  return `${deviceId.slice(0, 4)}…${deviceId.slice(-4)}`;
};

export const createStableClientId = (value) => (
  `client_${createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16)}`
);

export const normalizeModelVersions = (...versionLists) => (
  [...new Set(
    versionLists
      .flat()
      .map(asFiniteNumber)
      .filter((value) => value !== null && value >= 0),
  )].sort((left, right) => left - right)
);

export const normalizeRoundLimit = (value) => {
  if (String(value).toLowerCase() === 'all') return MAX_ROUND_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_ROUND_LIMIT;
  return Math.min(parsed, MAX_ROUND_LIMIT);
};

const normalizeGlobalSeries = (logs = []) => logs
  .map((log) => ({
    round: asFiniteNumber(log?.round),
    modelVersion: asFiniteNumber(log?.gl_model_v),
    loss: asFiniteNumber(log?.gl_loss),
    accuracy: asFiniteNumber(log?.gl_accuracy),
    evaluationSource: log?.evaluation_source || 'legacy',
    evaluationStatus: log?.evaluation_status || null,
    evaluationClients: asFiniteNumber(log?.evaluation_clients),
    evaluationSamples: asFiniteNumber(log?.evaluation_samples),
    accuracySamples: asFiniteNumber(log?.accuracy_samples),
    evaluationFailures: asFiniteNumber(log?.evaluation_failures),
    additionalMetrics: log?.additional_metrics || {},
    campaignRunId: log?.campaign_run_id || null,
    roundTimeSeconds: asFiniteNumber(log?.run_time_by_round),
    observedAt: normalizeTimestamp(null, log?._id),
  }))
  .filter((point) => point.round !== null)
  .sort((left, right) => left.round - right.round);

const normalizeTrainSeries = (logs = []) => logs
  .map((log) => ({
    round: asFiniteNumber(log?.round),
    trainLoss: asFiniteNumber(log?.train_loss),
    trainAccuracy: asFiniteNumber(log?.train_accuracy),
    validationLoss: asFiniteNumber(log?.val_loss),
    validationAccuracy: asFiniteNumber(log?.val_accuracy),
    trainTimeSeconds: asFiniteNumber(log?.train_time),
    observedAt: normalizeTimestamp(null, log?._id),
  }))
  .filter((point) => point.round !== null)
  .sort((left, right) => left.round - right.round);

const normalizeTestSeries = (logs = []) => logs
  .map((log) => ({
    round: asFiniteNumber(log?.round),
    testLoss: asFiniteNumber(log?.test_loss),
    testAccuracy: asFiniteNumber(log?.test_accuracy),
    observedAt: normalizeTimestamp(null, log?._id),
  }))
  .filter((point) => point.round !== null)
  .sort((left, right) => left.round - right.round);

const normalizeSystemSeries = (logs = []) => logs
  .map((log) => ({
    runtimeSeconds: asFiniteNumber(log?.runtime),
    observedAt: normalizeTimestamp(log?.timestamp, log?._id),
    cpuUtilization: asFiniteNumber(log?.cpu_utilization),
    cpuThreads: asFiniteNumber(log?.cpu_threads),
    memoryUtilization: asFiniteNumber(log?.memory_utilization),
    processMemoryPercent: asFiniteNumber(log?.memory_percent),
    memoryRssMb: asFiniteNumber(log?.memory_rssMB),
    memoryAvailableMb: asFiniteNumber(log?.memory_availableMB),
    diskUtilization: asFiniteNumber(log?.disk_utilization),
    networkSentBytes: asFiniteNumber(log?.network_sent),
    networkReceivedBytes: asFiniteNumber(log?.network_recv),
  }))
  .sort((left, right) => (
    (left.runtimeSeconds ?? 0) - (right.runtimeSeconds ?? 0)
  ));

const normalizeClientSummaries = ({
  trainSummaries = [],
  testSummaries = [],
  systemSummaries = [],
}) => {
  const clients = new Map();

  const ensureClient = (row) => {
    const id = String(row?.id || row?._id || '');
    if (!id) return null;
    if (!clients.has(id)) {
      clients.set(id, {
        id: createStableClientId(id),
        sourceId: id,
        name: '',
        deviceLabel: maskDeviceId(id),
        lastRound: null,
        trainLoss: null,
        trainAccuracy: null,
        validationLoss: null,
        validationAccuracy: null,
        testLoss: null,
        testAccuracy: null,
        trainTimeSeconds: null,
        cpuUtilization: null,
        memoryUtilization: null,
        lastSeenAt: null,
      });
    }
    return clients.get(id);
  };

  trainSummaries.forEach((row) => {
    const client = ensureClient(row);
    if (!client) return;
    client.name = row.clientName || client.name;
    client.lastRound = asFiniteNumber(row.round);
    client.trainLoss = asFiniteNumber(row.trainLoss);
    client.trainAccuracy = asFiniteNumber(row.trainAccuracy);
    client.validationLoss = asFiniteNumber(row.validationLoss);
    client.validationAccuracy = asFiniteNumber(row.validationAccuracy);
    client.trainTimeSeconds = asFiniteNumber(row.trainTimeSeconds);
    client.lastSeenAt = latestTimestamp(
      client.lastSeenAt,
      normalizeTimestamp(null, row.latestId),
    );
  });

  testSummaries.forEach((row) => {
    const client = ensureClient(row);
    if (!client) return;
    client.name = row.clientName || client.name;
    client.lastRound = Math.max(
      client.lastRound ?? 0,
      asFiniteNumber(row.round) ?? 0,
    ) || null;
    client.testLoss = asFiniteNumber(row.testLoss);
    client.testAccuracy = asFiniteNumber(row.testAccuracy);
    client.lastSeenAt = latestTimestamp(
      client.lastSeenAt,
      normalizeTimestamp(null, row.latestId),
    );
  });

  systemSummaries.forEach((row) => {
    const client = ensureClient(row);
    if (!client) return;
    client.cpuUtilization = asFiniteNumber(row.cpuUtilization);
    client.memoryUtilization = asFiniteNumber(row.memoryUtilization);
    client.lastSeenAt = latestTimestamp(
      client.lastSeenAt,
      normalizeTimestamp(row.timestamp, row.latestId),
    );
  });

  return [...clients.values()]
    .map((client) => ({
      ...client,
      name: client.name || `Client ${client.deviceLabel}`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const buildTaskMonitoringSnapshot = ({
  activity,
  availableModelVersions = [],
  selectedModelVersion = null,
  selectedClientId = 'all',
  roundLimit = DEFAULT_ROUND_LIMIT,
  globalLogs = [],
  trainSummaries = [],
  testSummaries = [],
  systemSummaries = [],
  trainLogs = [],
  testLogs = [],
  systemLogs = [],
  observedAt = new Date(),
}) => {
  const globalSeries = normalizeGlobalSeries(globalLogs);
  const clientSummaries = normalizeClientSummaries({
    trainSummaries,
    testSummaries,
    systemSummaries,
  });
  const safeClientSummaries = clientSummaries.map(({ sourceId, ...client }) => client);
  const clients = safeClientSummaries.map((client) => ({
    id: client.id,
    name: client.name,
    deviceLabel: client.deviceLabel,
    lastSeenAt: client.lastSeenAt,
  }));
  const resolvedClientId = selectedClientId !== 'all'
    && clients.some((client) => client.id === String(selectedClientId))
    ? String(selectedClientId)
    : 'all';
  const latestGlobal = globalSeries.at(-1) || null;
  const previousGlobal = globalSeries.at(-2) || null;
  const roundTimes = globalSeries
    .map((point) => point.roundTimeSeconds)
    .filter((value) => value !== null);
  const averageRoundTimeSeconds = roundTimes.length
    ? roundTimes.reduce((sum, value) => sum + value, 0) / roundTimes.length
    : null;

  return {
    schemaVersion: 1,
    context: {
      availableModelVersions,
      selectedModelVersion,
      selectedClientId: resolvedClientId,
      clients,
      roundLimit,
      observedAt,
    },
    run: activity?.run || null,
    participants: activity?.participants || {},
    summary: {
      latestGlobal,
      previousGlobal,
      accuracyDelta: Number.isFinite(latestGlobal?.accuracy)
        && Number.isFinite(previousGlobal?.accuracy)
        ? latestGlobal.accuracy - previousGlobal.accuracy
        : null,
      lossDelta: Number.isFinite(latestGlobal?.loss)
        && Number.isFinite(previousGlobal?.loss)
        ? latestGlobal.loss - previousGlobal.loss
        : null,
      averageRoundTimeSeconds,
    },
    globalSeries,
    clientSummaries: safeClientSummaries,
    selectedClientSeries: {
      train: resolvedClientId === 'all' ? [] : normalizeTrainSeries(trainLogs),
      test: resolvedClientId === 'all' ? [] : normalizeTestSeries(testLogs),
      system: resolvedClientId === 'all' ? [] : normalizeSystemSeries(systemLogs),
    },
    source: {
      ...(activity?.source || {}),
      type: 'owner_monitoring_snapshot',
      observedAt,
    },
  };
};

const latestClientAggregation = (match, projection) => ([
  { $match: match },
  { $sort: { round: -1, _id: -1 } },
  { $group: { _id: '$client_mac', record: { $first: '$$ROOT' } } },
  {
    $project: {
      _id: 0,
      id: '$_id',
      latestId: '$record._id',
      clientName: '$record.client_name',
      round: '$record.round',
      ...projection,
    },
  },
]);

export const loadTaskMonitoring = async (task, user, query = {}) => {
  const runtimeKey = task.runtimeKey || task.title;
  const connection = mongoose.connection;
  const globalCollection = connection.collection('fl-gl_model_evaluation_log');
  const trainCollection = connection.collection('fl-client_train_result_log');
  const testCollection = connection.collection('fl-client_test_result_log');
  const systemCollection = connection.collection('fl-client_basic_system_log');
  const roundLimit = normalizeRoundLimit(query.rounds);

  const [globalVersions, trainVersions, testVersions] = await Promise.all([
    globalCollection.distinct('gl_model_v', { fl_task_id: runtimeKey }),
    trainCollection.distinct('gl_model_v', { fl_task_id: runtimeKey }),
    testCollection.distinct('gl_model_v', { fl_task_id: runtimeKey }),
  ]);
  const availableModelVersions = normalizeModelVersions(
    globalVersions,
    trainVersions,
    testVersions,
  );
  const requestedVersion = asFiniteNumber(query.modelVersion);
  const selectedModelVersion = requestedVersion !== null
    && availableModelVersions.includes(requestedVersion)
    ? requestedVersion
    : availableModelVersions.at(-1) ?? null;
  const versionMatch = selectedModelVersion === null
    ? { fl_task_id: runtimeKey }
    : { fl_task_id: runtimeKey, gl_model_v: selectedModelVersion };
  const clientMatch = {
    ...versionMatch,
    client_mac: { $exists: true, $nin: [null, ''] },
  };

  const [
    activity,
    globalLogsDescending,
    trainSummaries,
    testSummaries,
    systemSummaries,
  ] = await Promise.all([
    loadTaskActivity(task, user),
    globalCollection
      .find(versionMatch)
      .sort({ round: -1, _id: -1 })
      .limit(roundLimit)
      .toArray(),
    trainCollection.aggregate(latestClientAggregation(clientMatch, {
      trainLoss: '$record.train_loss',
      trainAccuracy: '$record.train_accuracy',
      validationLoss: '$record.val_loss',
      validationAccuracy: '$record.val_accuracy',
      trainTimeSeconds: '$record.train_time',
    })).toArray(),
    testCollection.aggregate(latestClientAggregation(clientMatch, {
      testLoss: '$record.test_loss',
      testAccuracy: '$record.test_accuracy',
    })).toArray(),
    systemCollection.aggregate([
      { $match: clientMatch },
      { $sort: { timestamp: -1, _id: -1 } },
      { $group: { _id: '$client_mac', record: { $first: '$$ROOT' } } },
      {
        $project: {
          _id: 0,
          id: '$_id',
          latestId: '$record._id',
          timestamp: '$record.timestamp',
          cpuUtilization: '$record.cpu_utilization',
          memoryUtilization: '$record.memory_utilization',
        },
      },
    ]).toArray(),
  ]);

  const normalizedClients = normalizeClientSummaries({
    trainSummaries,
    testSummaries,
    systemSummaries,
  });
  const requestedClientId = String(query.client || 'all');
  const selectedClient = requestedClientId === 'all'
    ? null
    : normalizedClients.find((client) => client.id === requestedClientId);
  const selectedClientId = selectedClient?.id || 'all';
  const selectedClientMatch = !selectedClient
    ? null
    : { ...versionMatch, client_mac: selectedClient.sourceId };

  const [trainLogs, testLogs, systemLogs] = selectedClientMatch
    ? await Promise.all([
      trainCollection
        .find(selectedClientMatch)
        .sort({ round: -1, _id: -1 })
        .limit(roundLimit)
        .toArray(),
      testCollection
        .find(selectedClientMatch)
        .sort({ round: -1, _id: -1 })
        .limit(roundLimit)
        .toArray(),
      systemCollection
        .find(selectedClientMatch)
        .sort({ timestamp: -1, _id: -1 })
        .limit(MAX_SYSTEM_POINTS)
        .toArray(),
    ])
    : [[], [], []];

  return buildTaskMonitoringSnapshot({
    activity,
    availableModelVersions,
    selectedModelVersion,
    selectedClientId,
    roundLimit,
    globalLogs: globalLogsDescending,
    trainSummaries,
    testSummaries,
    systemSummaries,
    trainLogs,
    testLogs,
    systemLogs,
  });
};
