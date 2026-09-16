import TaskParticipant from '../models/task_participant.js';
import { resolveTaskCard } from './taskCard.js';
import { resolveTaskRuntimeContract } from './taskRuntimeContract.js';
import { participantLeavePolicy } from './taskParticipation.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'ccl@ccl.com';

export const isAdmin = (user) => Boolean(user?.username && user.username === ADMIN_USERNAME);

export const isTaskOwner = (user, task) => {
  if (!user || !task) return false;
  const ownerId = task.ownerId || task.user?._id;
  return Boolean(ownerId && String(ownerId) === String(user._id));
};

export const effectiveVisibility = (task) => (
  task?.visibility === 'public' ? 'public' : 'private'
);

export const hasPublishedTaskRelease = (task) => (
  task?.registryStatus === 'published'
  && Boolean(task?.currentPublishedReleaseId)
);

// FedOps 1.3 Release artifacts contain the executable Federated Task contract.
// Public discovery exposes the Task card, while artifact access requires an
// Owner/Admin role or an approved Federated Learning participation.
export const requiresApprovedArtifactAccess = (task) => hasPublishedTaskRelease(task);

export const isLegacyPublicTask = (task) => (
  effectiveVisibility(task) === 'public'
  && !task?.registryStatus
);

export const isPubliclyDiscoverableTask = (task) => (
  effectiveVisibility(task) === 'public'
  && task?.modelType !== 'SBA-FL'
  && (hasPublishedTaskRelease(task) || isLegacyPublicTask(task))
);

export const publicRegistryFilter = () => ({
  visibility: 'public',
  modelType: { $ne: 'SBA-FL' },
  $or: [
    {
      registryStatus: 'published',
      currentPublishedReleaseId: { $exists: true, $nin: [null, ''] },
    },
    { registryStatus: { $exists: false } },
    { registryStatus: null },
  ],
});

export const hasApprovedParticipation = async (user, task) => {
  if (!user || !task?._id) return false;
  return Boolean(await TaskParticipant.exists({
    taskId: task._id,
    userId: user._id,
    status: 'approved',
  }));
};

export const canViewTask = async (user, task) => {
  if (isPubliclyDiscoverableTask(task)) return true;
  if (isAdmin(user) || isTaskOwner(user, task)) return true;
  return hasApprovedParticipation(user, task);
};

export const canManageTask = (user, task) => (
  isAdmin(user) || isTaskOwner(user, task)
);

export const taskPermissions = async (user, task, knownParticipation = undefined) => {
  const owner = isTaskOwner(user, task);
  const admin = isAdmin(user);
  let participation = null;
  if (user && !owner) {
    participation = knownParticipation !== undefined
      ? knownParticipation
      : await TaskParticipant.findOne({
      taskId: task._id,
      userId: user._id,
      }).select(
        'status completedParticipationCount approvalParticipationBaseline lastParticipatedAt leftAt',
      ).lean();
  }
  const participant = participation?.status === 'approved';
  const leavePolicy = participantLeavePolicy(participation);
  const canAccessArtifacts = owner
    || admin
    || participant
    || (
      !requiresApprovedArtifactAccess(task)
      && isPubliclyDiscoverableTask(task)
    );
  return {
    canView: isPubliclyDiscoverableTask(task) || owner || admin || participant,
    canManage: owner || admin,
    canDownloadModels: canAccessArtifacts,
    canRequestParticipation: Boolean(
      user
      && !owner
      && !participant
      && participation?.status !== 'requested'
      && task?.participationPolicy !== 'closed'
      && isPubliclyDiscoverableTask(task)
    ),
    canOpenWorkspace: owner || admin || participant,
    isOwner: owner,
    isAdmin: admin,
    isParticipant: participant,
    participationStatus: participation?.status || null,
    canLeaveParticipation: leavePolicy.canLeave,
    leaveRequiresCompletedRun: leavePolicy.requiresCompletedRun,
    completedParticipationCount: Number(
      participation?.completedParticipationCount || 0,
    ),
    lastParticipatedAt: participation?.lastParticipatedAt || null,
  };
};

export const toPublicTask = async (task, user = null, knownPermissions = null) => {
  const source = typeof task.toObject === 'function' ? task.toObject() : task;
  const permissions = knownPermissions || await taskPermissions(user, source);
  return {
    taskId: String(source._id),
    id: `${source.ownerHandle || 'unknown'}/${source.slug || source.title}`,
    title: source.displayName || source.title,
    displayName: source.displayName || source.title,
    runtimeKey: source.runtimeKey || source.title,
    slug: source.slug,
    summary: source.summary || source.description || '',
    description: source.description || '',
    cardMarkdown: resolveTaskCard(source),
    tags: source.tags || '',
    visibility: effectiveVisibility(source),
    participationPolicy: source.participationPolicy || 'approval_required',
    owner: {
      handle: source.ownerHandle || 'unknown',
    },
    dataType: source.dataType,
    modelType: source.modelType,
    taskCategory: source.taskCategory || null,
    dataModality: source.dataModality || null,
    primaryModel: source.primaryModel || null,
    strategy: source.strategy,
    status: source.status || 'not_start',
    learningRate: source.learningRate,
    numEpochs: source.numEpochs,
    batchSize: source.batchSize,
    numRounds: source.numRounds,
    clientPerRound: source.clientPerRound,
    publishedAt: source.registryStatus
      ? (source.publishedAt || null)
      : (source.publishedAt || source.publishedDate),
    registryStatus: source.registryStatus || 'legacy',
    runtimeContract: resolveTaskRuntimeContract(source),
    currentPublishedReleaseId: source.currentPublishedReleaseId || null,
    createdAt: source.createdAt || source.publishedDate,
    updatedAt: source.updatedAt,
    permissions,
  };
};

export const toAuthorizedTask = async (task, user) => {
  const source = typeof task.toObject === 'function' ? task.toObject() : task;
  const permissions = await taskPermissions(user, source);
  if (!canManageTask(user, source)) {
    const publicTask = await toPublicTask(source, user, permissions);
    if (!permissions.isParticipant) return publicTask;
    return {
      ...publicTask,
      taskId: String(source._id),
      runtimeKey: source.runtimeKey || source.title,
      yamlConfig: source.yamlConfig || '',
      permissions,
    };
  }
  return {
    ...source,
    taskId: String(source._id),
    displayName: source.displayName || source.title,
    visibility: effectiveVisibility(source),
    runtimeKey: source.runtimeKey || source.title,
    ownerHandle: source.ownerHandle || 'unknown',
    participationPolicy: source.participationPolicy || 'approval_required',
    runtimeContract: resolveTaskRuntimeContract(source),
    permissions,
  };
};
