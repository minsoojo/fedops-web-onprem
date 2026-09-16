import axios from 'axios';
import { serverManagerUrl as SERVER_MANAGER_URL } from '../config/serverManager.js';
import mongoose from 'mongoose';
import TaskParticipant from '../models/task_participant.js';
import CampaignRun from '../models/campaign_run.js';
import { isAdmin, isTaskOwner } from './taskAccess.js';

const MANAGER_TIMEOUT_MS = 2500;
const MAX_METRIC_POINTS = 24;

const asFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

const objectIdTimestamp = (value) => {
  if (!value) return null;
  try {
    const objectId = value instanceof mongoose.Types.ObjectId
      ? value
      : new mongoose.Types.ObjectId(value);
    return objectId.getTimestamp();
  } catch {
    return null;
  }
};

const latestDate = (...values) => {
  const dates = values
    .flat()
    .filter(Boolean)
    .map((value) => {
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter(Boolean);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((value) => value.getTime())));
};

const normalizeServerStart = (value) => {
  if (!value || typeof value !== 'string') return null;
  const legacyMatch = value.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2})-(\d{2})-(\d{2})$/,
  );
  if (legacyMatch) {
    return `${legacyMatch[1]}T${legacyMatch[2]}:${legacyMatch[3]}:${legacyMatch[4]}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const normalizeLegacyRunStatus = (taskStatus, managerStatus, hasMetrics) => {
  const managerValue = String(managerStatus || '').toLowerCase();
  if (managerValue.includes('error') || managerValue.includes('fail')) return 'failed';
  if (managerValue.includes('finished') || managerValue.includes('completed')) return 'completed';
  if (managerValue.includes('paused')) return 'paused';
  if (managerValue.includes('running')) return 'training';
  if (managerValue.includes('created') || managerValue.includes('ready')) return 'ready';
  if (managerValue.includes('initial')) return 'preparing';

  if (taskStatus === 'training') return 'training';
  if (taskStatus === 'waiting') return 'ready';
  if (taskStatus === 'creating') return 'preparing';
  if (hasMetrics) return 'completed';
  return 'not_started';
};

const safeMetric = (log) => ({
  round: asFiniteNumber(log?.round),
  modelVersion: asFiniteNumber(log?.gl_model_v),
  loss: asFiniteNumber(log?.gl_loss),
  accuracy: asFiniteNumber(log?.gl_accuracy),
  roundTimeSeconds: asFiniteNumber(log?.run_time_by_round),
});

export const buildTaskActivity = ({
  task,
  approvedParticipants = 0,
  selfMembership = null,
  globalLogs = [],
  latestClientRound = null,
  contributedParticipants = 0,
  completedParticipants = 0,
  latestClientLogId = null,
  managerSummary = null,
  campaignRun = null,
  user = null,
  observedAt = new Date(),
}) => {
  const safeGlobalLogs = globalLogs
    .map(safeMetric)
    .filter((metric) => metric.round !== null)
    .sort((left, right) => left.round - right.round)
    .slice(-MAX_METRIC_POINTS);
  const latestMetric = safeGlobalLogs.at(-1) || null;
  const runCampaign = campaignRun?.campaign || task?.campaignConfig;
  const totalRounds = asFiniteNumber(runCampaign?.rounds ?? task?.numRounds);
  const clientsPerRound = asFiniteNumber(
    runCampaign?.clientsPerRound ?? task?.clientPerRound,
  );
  const currentRound = Math.max(
    0,
    latestMetric?.round || 0,
    asFiniteNumber(latestClientRound) || 0,
  );
  const progressPercent = totalRounds && totalRounds > 0
    ? clampPercent((currentRound / totalRounds) * 100)
    : null;

  const managerStatus = managerSummary?.server_status?.status;
  const normalizedStatus = normalizeLegacyRunStatus(
    task?.status,
    managerStatus,
    safeGlobalLogs.length > 0,
  );
  const managerClientStats = managerSummary?.client_stats || {};
  const selectedDevices = managerSummary?.server_status?.selected_devices;
  const participantCounts = {
    approved: approvedParticipants,
    contributed: contributedParticipants,
    registeredDevices: asFiniteNumber(managerClientStats.total),
    onlineDevices: asFiniteNumber(managerClientStats.online),
    trainingDevices: asFiniteNumber(managerClientStats.training),
    selectedThisRun: Array.isArray(selectedDevices) ? selectedDevices.length : null,
    completedCurrentRound: completedParticipants,
  };

  const globalLogDates = globalLogs.map((log) => objectIdTimestamp(log?._id));
  const lastUpdatedAt = latestDate(
    task?.updatedAt,
    task?.publishedAt,
    globalLogDates,
    objectIdTimestamp(latestClientLogId),
  );
  const managerModelVersion = asFiniteNumber(
    managerSummary?.fl_server_info?.model_version,
  );

  let membership = null;
  if (user && isTaskOwner(user, task)) {
    membership = {
      role: 'owner',
      status: 'owner',
      requestedAt: null,
      reviewedAt: null,
    };
  } else if (selfMembership) {
    membership = {
      role: 'participant',
      status: selfMembership.status,
      requestedAt: selfMembership.requestedAt || selfMembership.createdAt || null,
      reviewedAt: selfMembership.reviewedAt || null,
      completedParticipationCount: Number(
        selfMembership.completedParticipationCount || 0,
      ),
      lastParticipatedAt: selfMembership.lastParticipatedAt || null,
      leftAt: selfMembership.leftAt || null,
    };
  } else if (isAdmin(user)) {
    membership = {
      role: 'admin',
      status: 'admin',
      requestedAt: null,
      reviewedAt: null,
    };
  }

  return {
    schemaVersion: 1,
    run: {
      kind: campaignRun ? 'campaign' : 'legacy_current',
      runId: campaignRun?.runId || null,
      status: normalizedStatus,
      phase: managerStatus ? normalizedStatus : null,
      currentRound,
      totalRounds,
      clientsPerRound,
      strategy: runCampaign?.strategy?.name || task?.strategy || null,
      progressPercent,
      startedAt: campaignRun?.startedAt
        || normalizeServerStart(managerSummary?.fl_server_info?.start_time),
      endedAt: campaignRun?.endedAt || null,
      baseGlobalModelVersion: campaignRun?.baseGlobalModelVersion ?? null,
      targetGlobalModelVersion: campaignRun?.targetGlobalModelVersion ?? null,
      lastUpdatedAt,
      latestModelVersion: Math.max(
        0,
        latestMetric?.modelVersion || 0,
        managerModelVersion || 0,
      ) || null,
    },
    participants: participantCounts,
    metrics: {
      latest: latestMetric,
      history: safeGlobalLogs,
    },
    membership,
    source: {
      type: 'legacy_aggregate',
      estimated: true,
      managerAvailable: Boolean(managerSummary),
      observedAt,
    },
  };
};

const loadManagerSummary = async (runtimeKey) => {
  try {
    const response = await axios.get(
      `${SERVER_MANAGER_URL}/FLSe/GetTaskSummary/${encodeURIComponent(runtimeKey)}`,
      { timeout: MANAGER_TIMEOUT_MS },
    );
    return response.data && !response.data.error ? response.data : null;
  } catch {
    return null;
  }
};

export const loadTaskActivity = async (task, user = null) => {
  const runtimeKey = task.runtimeKey || task.title;
  const connection = mongoose.connection;
  const globalCollection = connection.collection('fl-gl_model_evaluation_log');
  const trainCollection = connection.collection('fl-client_train_result_log');
  const campaignRun = task.currentCampaignRunId
    ? await CampaignRun.findOne({
      taskId: task._id,
      runId: task.currentCampaignRunId,
    }).lean()
    : null;
  const metricMatch = {
    fl_task_id: runtimeKey,
    ...(campaignRun?.targetGlobalModelVersion
      ? { gl_model_v: campaignRun.targetGlobalModelVersion }
      : {}),
  };

  const [
    approvedParticipants,
    selfMembership,
    globalLogs,
    latestRoundRows,
    contributedRows,
    managerSummary,
  ] = await Promise.all([
    TaskParticipant.countDocuments({
      taskId: task._id,
      status: 'approved',
    }),
    user
      ? TaskParticipant.findOne({
        taskId: task._id,
        userId: user._id,
      }).select(
        'status requestedAt reviewedAt completedParticipationCount '
        + 'lastParticipatedAt leftAt createdAt',
      ).lean()
      : null,
    globalCollection
      .find(
        metricMatch,
        {
          projection: {
            round: 1,
            gl_model_v: 1,
            gl_loss: 1,
            gl_accuracy: 1,
            run_time_by_round: 1,
          },
        },
      )
      .sort({ round: -1, _id: -1 })
      .limit(MAX_METRIC_POINTS)
      .toArray(),
    trainCollection.aggregate([
      { $match: metricMatch },
      {
        $group: {
          _id: '$round',
          completedClients: { $addToSet: '$client_mac' },
          latestId: { $max: '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          round: '$_id',
          completedParticipants: { $size: '$completedClients' },
          latestId: 1,
        },
      },
      { $sort: { round: -1 } },
      { $limit: 1 },
    ]).toArray(),
    trainCollection.aggregate([
      {
        $match: {
          ...metricMatch,
          client_mac: { $nin: [null, ''] },
        },
      },
      { $group: { _id: '$client_mac' } },
      { $count: 'total' },
    ]).toArray(),
    loadManagerSummary(runtimeKey),
  ]);

  const latestRound = latestRoundRows[0] || {};
  return buildTaskActivity({
    task,
    approvedParticipants,
    selfMembership,
    globalLogs,
    latestClientRound: latestRound.round,
    contributedParticipants: contributedRows[0]?.total || 0,
    completedParticipants: latestRound.completedParticipants || 0,
    latestClientLogId: latestRound.latestId,
    managerSummary,
    campaignRun,
    user,
  });
};
