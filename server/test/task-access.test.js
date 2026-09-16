import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveVisibility,
  isPubliclyDiscoverableTask,
  isTaskOwner,
  requiresApprovedArtifactAccess,
  taskPermissions,
  toPublicTask,
} from '../src/lib/taskAccess.js';
import {
  defaultUserHandle,
  isValidHandle,
  slugify,
} from '../src/lib/slugs.js';
import {
  buildTaskActivity,
  normalizeLegacyRunStatus,
} from '../src/lib/taskActivity.js';
import {
  buildTaskMonitoringSnapshot,
  createStableClientId,
  normalizeModelVersions,
  normalizeRoundLimit,
} from '../src/lib/taskMonitoring.js';
import { buildDefaultTaskCard } from '../src/lib/taskCard.js';
import {
  buildDefaultTaskFiles,
  isTaskFilePreviewable,
  taskFilePreviewLanguage,
} from '../src/lib/taskFiles.js';
import {
  getDefaultBaselineTemplate,
  taskTemplateDestinationPrefix,
  templateObjectPrefix,
  validateBaselineManifest,
} from '../src/lib/baselineTemplate.js';
import { buildTaskUsageSeries } from '../src/lib/taskUsage.js';
import {
  completedSinceApproval,
  participantLeavePolicy,
  participantReviewPolicy,
} from '../src/lib/taskParticipation.js';
import {
  buildDefaultTaskRuntimeContract,
  buildLegacyTaskRuntimeContract,
  resolveTaskRuntimeContract,
  taskRuntimeManagerPayload,
} from '../src/lib/taskRuntimeContract.js';

const owner = {
  _id: '64b000000000000000000001',
  username: 'owner@example.com',
};

const admin = {
  _id: '64b000000000000000000002',
  username: 'ccl@ccl.com',
};

test('legacy tasks without visibility remain private', () => {
  assert.equal(effectiveVisibility({}), 'private');
  assert.equal(effectiveVisibility({ visibility: 'public' }), 'public');
});

test('unversioned existing Tasks keep the legacy FedOps runtime contract', () => {
  assert.deepEqual(resolveTaskRuntimeContract({}), {
    name: 'legacy-v1',
    schemaVersion: 1,
    fedopsVersion: '1.1.30.13',
    sourceRevision: '7cdd9840d7cacdef7ce3be96248a206fd06d496b',
    baselineVersion: null,
  });
  assert.deepEqual(taskRuntimeManagerPayload({}), {
    runtime_contract: 'legacy-v1',
  });
});

test('Baseline metadata alone never upgrades an existing Task Runtime', () => {
  assert.equal(resolveTaskRuntimeContract({
    baselineTemplate: { version: '0.3.0' },
  }).name, 'legacy-v1');
  assert.equal(resolveTaskRuntimeContract({
    baselineTemplate: { version: '0.6.0' },
  }).name, 'legacy-v1');
  assert.deepEqual(buildDefaultTaskRuntimeContract({ version: '0.6.0' }), {
    name: 'federated-task-v2',
    schemaVersion: 2,
    fedopsVersion: '1.1.30.14',
    sourceRevision: 'b88732b4c75194034ba651df514cf5a32334150d',
    baselineVersion: '0.6.0',
  });
  assert.deepEqual(buildDefaultTaskRuntimeContract({ version: '0.7.0' }), {
    name: 'federated-task-v3',
    schemaVersion: 3,
    fedopsVersion: '1.1.30.15',
    sourceRevision: 'fde3137f6e94bc4558352b109a8c87186d20208c',
    baselineVersion: '0.7.0',
  });
  assert.deepEqual(buildDefaultTaskRuntimeContract({ version: '0.16.0' }), {
    name: 'federated-task-v3',
    schemaVersion: 3,
    fedopsVersion: '1.1.30.15',
    sourceRevision: 'fde3137f6e94bc4558352b109a8c87186d20208c',
    baselineVersion: '0.16.0',
  });
  assert.deepEqual(buildDefaultTaskRuntimeContract({ version: '1.0.0' }), {
    name: 'federated-task-v3',
    schemaVersion: 3,
    fedopsVersion: '1.1.30.15',
    sourceRevision: 'fde3137f6e94bc4558352b109a8c87186d20208c',
    baselineVersion: '1.0.0',
  });
  assert.deepEqual(buildLegacyTaskRuntimeContract(), {
    name: 'legacy-v1',
    schemaVersion: 1,
    fedopsVersion: '1.1.30.13',
    sourceRevision: '7cdd9840d7cacdef7ce3be96248a206fd06d496b',
    baselineVersion: null,
  });
});

test('an explicitly stored Runtime contract is stable across Baseline defaults', () => {
  const task = {
    baselineTemplate: { version: '0.6.0' },
    runtimeContract: {
      name: 'legacy-v1',
      baselineVersion: null,
    },
  };
  assert.equal(resolveTaskRuntimeContract(task).name, 'legacy-v1');
  assert.equal(resolveTaskRuntimeContract(task).fedopsVersion, '1.1.30.13');
});

test('SBA-FL tasks are never discoverable through the Public Task registry', () => {
  assert.equal(isPubliclyDiscoverableTask({
    visibility: 'public',
    modelType: 'SBA-FL',
  }), false);
  assert.equal(isPubliclyDiscoverableTask({
    visibility: 'public',
    modelType: 'AI',
  }), true);
  assert.equal(isPubliclyDiscoverableTask({
    visibility: 'private',
    modelType: 'AI',
  }), false);
});

test('new public Drafts require a Published Release before Registry discovery', () => {
  assert.equal(isPubliclyDiscoverableTask({
    visibility: 'public',
    modelType: 'AI',
    registryStatus: 'draft',
  }), false);
  assert.equal(isPubliclyDiscoverableTask({
    visibility: 'public',
    modelType: 'AI',
    registryStatus: 'published',
    currentPublishedReleaseId: 'release-1',
  }), true);
  assert.equal(isPubliclyDiscoverableTask({
    visibility: 'public',
    modelType: 'AI',
  }), true);
});

test('FedOps 1.3 Published Release artifacts require approved access', () => {
  assert.equal(requiresApprovedArtifactAccess({
    registryStatus: 'published',
    currentPublishedReleaseId: 'release-1',
  }), true);
  assert.equal(requiresApprovedArtifactAccess({
    visibility: 'public',
  }), false);
  assert.equal(requiresApprovedArtifactAccess({
    registryStatus: 'ready',
  }), false);
});

test('pending participation requests can be withdrawn before artifact access', () => {
  assert.deepEqual(participantLeavePolicy({ status: 'requested' }), {
    canLeave: true,
    requiresCompletedRun: false,
    reason: null,
  });
});

test('approved participants must complete a run in the current approval cycle before leaving', () => {
  const notYetParticipated = {
    status: 'approved',
    completedParticipationCount: 2,
    approvalParticipationBaseline: 2,
  };
  const participated = {
    ...notYetParticipated,
    completedParticipationCount: 3,
  };
  assert.equal(completedSinceApproval(notYetParticipated), false);
  assert.equal(participantLeavePolicy(notYetParticipated).canLeave, false);
  assert.equal(participantLeavePolicy(notYetParticipated).requiresCompletedRun, true);
  assert.equal(completedSinceApproval(participated), true);
  assert.equal(participantLeavePolicy(participated).canLeave, true);
});

test('left participants have no active membership and can rejoin through a new request', () => {
  const policy = participantLeavePolicy({
    status: 'left',
    completedParticipationCount: 1,
    approvalParticipationBaseline: 0,
  });
  assert.equal(policy.canLeave, false);
  assert.match(policy.reason, /no active participation/i);
});

test('a participant who left must submit a new request before owner approval', () => {
  assert.equal(participantReviewPolicy('left', 'approved').allowed, false);
  assert.equal(participantReviewPolicy('requested', 'approved').allowed, true);
  assert.equal(participantReviewPolicy('requested', 'rejected').allowed, true);
  assert.equal(participantReviewPolicy('approved', 'revoked').allowed, true);
});

test('public discovery does not grant Published Release artifact access', async () => {
  const permissions = await taskPermissions(null, {
    _id: '64b000000000000000000010',
    visibility: 'public',
    modelType: 'AI',
    registryStatus: 'published',
    currentPublishedReleaseId: 'release-1',
  });
  assert.equal(permissions.canView, true);
  assert.equal(permissions.canDownloadModels, false);
  assert.equal(permissions.canOpenWorkspace, false);
});

test('legacy embedded owner and new ownerId are both recognized', () => {
  assert.equal(isTaskOwner(owner, { user: { _id: owner._id } }), true);
  assert.equal(isTaskOwner(owner, { ownerId: owner._id }), true);
  assert.equal(isTaskOwner(
    { ...owner, _id: '64b000000000000000000002' },
    { ownerId: owner._id },
  ), false);
});

test('public task DTO never exposes runtime configuration or owner email', async () => {
  const dto = await toPublicTask({
    _id: '64b000000000000000000010',
    title: 'mnist',
    runtimeKey: 'mnist',
    slug: 'mnist',
    visibility: 'public',
    ownerHandle: 'researcher-01',
    user: { _id: owner._id, username: owner.username },
    yamlConfig: 'secret runtime config',
    serverRepoAddr: 'https://example.com/private.git',
    numRounds: '10',
    batchSize: '32',
    status: 'training',
  });
  assert.equal(dto.owner.handle, 'researcher-01');
  assert.equal(dto.visibility, 'public');
  assert.equal('yamlConfig' in dto, false);
  assert.equal('serverRepoAddr' in dto, false);
  assert.equal(dto.taskId, '64b000000000000000000010');
  assert.equal('_id' in dto, false);
  assert.equal('username' in dto.owner, false);
  assert.equal(dto.numRounds, '10');
  assert.equal(dto.batchSize, '32');
  assert.equal(dto.status, 'training');
});

test('owners retain management and model download permissions', async () => {
  const permissions = await taskPermissions(owner, {
    _id: '64b000000000000000000010',
    ownerId: owner._id,
    visibility: 'private',
  });
  assert.equal(permissions.canView, true);
  assert.equal(permissions.canManage, true);
  assert.equal(permissions.canDownloadModels, true);
  assert.equal(permissions.canOpenWorkspace, true);
  assert.equal(permissions.isOwner, true);
  assert.equal(permissions.isAdmin, false);
});

test('administrator management access does not become Task ownership', async () => {
  const permissions = await taskPermissions(admin, {
    _id: '64b000000000000000000010',
    ownerId: owner._id,
    visibility: 'public',
    modelType: 'AI',
    registryStatus: 'published',
    currentPublishedReleaseId: 'release-1',
  }, null);
  assert.equal(permissions.canView, true);
  assert.equal(permissions.canManage, true);
  assert.equal(permissions.canOpenWorkspace, true);
  assert.equal(permissions.canRequestParticipation, true);
  assert.equal(permissions.participationStatus, null);
  assert.equal(permissions.isOwner, false);
  assert.equal(permissions.isAdmin, true);
});

test('administrator participation remains separate from management access', async () => {
  const task = {
    _id: '64b000000000000000000010',
    ownerId: owner._id,
    visibility: 'public',
    modelType: 'AI',
    registryStatus: 'published',
    currentPublishedReleaseId: 'release-1',
  };
  const requested = await taskPermissions(admin, task, { status: 'requested' });
  const approved = await taskPermissions(admin, task, {
    status: 'approved',
    completedParticipationCount: 1,
  });

  assert.equal(requested.canManage, true);
  assert.equal(requested.canRequestParticipation, false);
  assert.equal(requested.isParticipant, false);
  assert.equal(requested.participationStatus, 'requested');
  assert.equal(approved.canManage, true);
  assert.equal(approved.isParticipant, true);
  assert.equal(approved.participationStatus, 'approved');
  assert.equal(approved.completedParticipationCount, 1);
});

test('handles and slugs use stable URL-safe values', () => {
  assert.equal(slugify('MNIST Public Task'), 'mnist-public-task');
  assert.equal(isValidHandle('researcher-01'), true);
  assert.equal(isValidHandle('Researcher'), false);
  assert.equal(
    defaultUserHandle({
      _id: '64b000000000000000abcdef',
      firstName: 'Fed',
      lastName: 'Ops',
    }),
    'fed-ops-legacy',
  );
});

test('legacy activity exposes aggregate progress without client identities', () => {
  const activity = buildTaskActivity({
    task: {
      _id: '64b000000000000000000010',
      title: 'mnist',
      ownerId: owner._id,
      status: 'training',
      numRounds: '10',
      updatedAt: new Date('2026-07-27T01:00:00Z'),
    },
    approvedParticipants: 7,
    globalLogs: [
      {
        _id: '64b000000000000000000011',
        round: 2,
        gl_model_v: 3,
        gl_loss: 0.3,
        gl_accuracy: 0.91,
      },
    ],
    latestClientRound: 3,
    contributedParticipants: 5,
    completedParticipants: 4,
    managerSummary: {
      server_status: {
        status: 'FL Server Running',
        selected_devices: ['private-device-a', 'private-device-b'],
      },
      client_stats: {
        total: 6,
        online: 5,
        training: 2,
      },
      fl_server_info: {
        model_version: 4,
        start_time: '2026-07-27 10-00-00',
      },
    },
    user: owner,
    observedAt: new Date('2026-07-27T02:00:00Z'),
  });

  assert.equal(activity.run.status, 'training');
  assert.equal(activity.run.phase, 'training');
  assert.equal(activity.run.currentRound, 3);
  assert.equal(activity.run.totalRounds, 10);
  assert.equal(activity.run.progressPercent, 30);
  assert.equal(activity.run.latestModelVersion, 4);
  assert.equal(activity.participants.approved, 7);
  assert.equal(activity.participants.onlineDevices, 5);
  assert.equal(activity.participants.selectedThisRun, 2);
  assert.equal(activity.participants.completedCurrentRound, 4);
  assert.equal(activity.membership.role, 'owner');
  assert.equal(activity.source.estimated, true);
  assert.equal(JSON.stringify(activity).includes('private-device-a'), false);
  assert.equal(JSON.stringify(activity).includes('FL Server Running'), false);
});

test('v3 activity uses the saved Campaign instead of legacy Task defaults', () => {
  const activity = buildTaskActivity({
    task: {
      numRounds: '10',
      clientPerRound: '5',
      strategy: 'LegacyStrategy',
      campaignConfig: {
        rounds: 3,
        clientsPerRound: 2,
        strategy: { name: 'FedAvg', parameters: {} },
      },
    },
  });

  assert.equal(activity.run.totalRounds, 3);
  assert.equal(activity.run.clientsPerRound, 2);
  assert.equal(activity.run.strategy, 'FedAvg');
});

test('a new Campaign Run resets round progress and preserves model lineage', () => {
  const activity = buildTaskActivity({
    task: {
      numRounds: '10',
      clientPerRound: '5',
      strategy: 'LegacyStrategy',
    },
    campaignRun: {
      runId: 'run-new',
      campaign: {
        rounds: 5,
        clientsPerRound: 3,
        strategy: { name: 'FedAvg', parameters: {} },
      },
      baseGlobalModelVersion: 1,
      targetGlobalModelVersion: 2,
      startedAt: new Date('2026-08-20T04:00:00Z'),
    },
    globalLogs: [],
    latestClientRound: null,
  });

  assert.equal(activity.run.kind, 'campaign');
  assert.equal(activity.run.runId, 'run-new');
  assert.equal(activity.run.currentRound, 0);
  assert.equal(activity.run.totalRounds, 5);
  assert.equal(activity.run.clientsPerRound, 3);
  assert.equal(activity.run.baseGlobalModelVersion, 1);
  assert.equal(activity.run.targetGlobalModelVersion, 2);
});

test('administrator activity is identified as admin rather than owner', () => {
  const activity = buildTaskActivity({
    task: {
      _id: '64b000000000000000000010',
      ownerId: owner._id,
      status: 'waiting',
    },
    user: admin,
    observedAt: new Date('2026-08-20T01:00:00Z'),
  });

  assert.deepEqual(activity.membership, {
    role: 'admin',
    status: 'admin',
    requestedAt: null,
    reviewedAt: null,
  });
});

test('legacy status normalization prefers explicit server state', () => {
  assert.equal(normalizeLegacyRunStatus('training', 'FL Server Finished', true), 'completed');
  assert.equal(normalizeLegacyRunStatus('waiting', null, false), 'ready');
  assert.equal(normalizeLegacyRunStatus('not_start', null, true), 'completed');
});

test('monitoring model versions and round limits are normalized', () => {
  assert.deepEqual(normalizeModelVersions([3, '1'], [2, 3, null], ['bad']), [1, 2, 3]);
  assert.equal(normalizeRoundLimit('10'), 10);
  assert.equal(normalizeRoundLimit('all'), 200);
  assert.equal(normalizeRoundLimit('bad'), 25);
  assert.equal(normalizeRoundLimit('999'), 200);
});

test('owner monitoring snapshot sorts metrics and resolves client context', () => {
  const clientId = createStableClientId('device-00112233');
  const snapshot = buildTaskMonitoringSnapshot({
    activity: {
      run: {
        status: 'training',
        currentRound: 2,
        totalRounds: 10,
      },
      participants: {
        selectedThisRun: 2,
        completedCurrentRound: 1,
      },
      source: {
        estimated: true,
      },
    },
    availableModelVersions: [1, 3],
    selectedModelVersion: 3,
    selectedClientId: clientId,
    globalLogs: [
      {
        round: 2,
        gl_model_v: 3,
        gl_loss: 0.25,
        gl_accuracy: 0.9,
        run_time_by_round: 12,
      },
      {
        round: 1,
        gl_model_v: 3,
        gl_loss: 0.4,
        gl_accuracy: 0.8,
        run_time_by_round: 18,
      },
    ],
    trainSummaries: [
      {
        id: 'device-00112233',
        clientName: 'edge-a',
        round: 2,
        trainLoss: 0.2,
        trainAccuracy: 0.92,
      },
    ],
    trainLogs: [
      { round: 2, train_loss: 0.2, train_accuracy: 0.92 },
      { round: 1, train_loss: 0.3, train_accuracy: 0.85 },
    ],
  });

  assert.equal(snapshot.context.selectedModelVersion, 3);
  assert.equal(snapshot.context.selectedClientId, clientId);
  assert.equal(snapshot.context.clients[0].name, 'edge-a');
  assert.equal(snapshot.context.clients[0].deviceLabel, 'devi…2233');
  assert.equal(JSON.stringify(snapshot).includes('device-00112233'), false);
  assert.deepEqual(snapshot.globalSeries.map((point) => point.round), [1, 2]);
  assert.ok(Math.abs(snapshot.summary.accuracyDelta - 0.1) < 1e-12);
  assert.ok(Math.abs(snapshot.summary.lossDelta + 0.15) < 1e-12);
  assert.equal(snapshot.summary.averageRoundTimeSeconds, 15);
  assert.deepEqual(
    snapshot.selectedClientSeries.train.map((point) => point.round),
    [1, 2],
  );
});

test('monitoring snapshot falls back to all clients for an unknown device', () => {
  const snapshot = buildTaskMonitoringSnapshot({
    activity: { run: null, participants: {}, source: {} },
    selectedClientId: 'not-registered',
    trainSummaries: [{ id: 'known-device', clientName: 'known' }],
  });
  assert.equal(snapshot.context.selectedClientId, 'all');
  assert.deepEqual(snapshot.selectedClientSeries, {
    train: [],
    test: [],
    system: [],
  });
});

test('default Task Card is Markdown and strips embedded HTML', () => {
  const markdown = buildDefaultTaskCard({
    title: 'vision-task',
    summary: '<strong>Vision</strong> task<script>bad()</script>',
    dataType: 'Image',
    modelType: 'Pytorch',
    strategy: 'FedAvg',
    numRounds: '10',
  });
  assert.match(markdown, /^# vision-task/m);
  assert.match(markdown, /## Data and input features/);
  assert.equal(markdown.includes('Public global models can be downloaded without joining'), false);
  assert.equal(markdown.includes('<script>'), false);
});

test('default baseline publishes versioned model and data preparation contracts', () => {
  const files = buildDefaultTaskFiles({ title: 'vision-task' });
  assert.deepEqual(
    files.map((file) => file.path),
    [
      'default_baseline/README.md',
      'default_baseline/model.py',
      'default_baseline/data_preparation.py',
    ],
  );
  assert.equal(files.every((file) => file.size > 0), true);
  assert.equal(files.every((file) => /^[a-f0-9]{64}$/.test(file.checksum)), true);
  assert.match(
    files.find((file) => file.path.endsWith('data_preparation.py')).content,
    /describe_input_features/,
  );
});

test('immutable Baseline template paths and manifest contract are validated', () => {
  const template = getDefaultBaselineTemplate();
  assert.deepEqual(template, {
    name: 'federated-task-baseline',
    version: '0.12.0',
    revision: 1,
  });
  assert.equal(
    templateObjectPrefix(template),
    'task-hub/_templates/federated-task-baseline/0.12.0',
  );
  assert.equal(
    taskTemplateDestinationPrefix(
      { _id: '64b000000000000000000010' },
      template,
    ),
    'task-hub/64b000000000000000000010/files/baseline-0.12.0',
  );
  const manifest = {
    baseline: {
      name: template.name,
      release_version: template.version,
      template_revision: template.revision,
    },
    files: [
      {
        path: 'fedops_silo_baseline/model.py',
        sha256: 'a'.repeat(64),
        size: 10,
        content_type: 'text/x-python',
      },
    ],
  };
  assert.equal(validateBaselineManifest(manifest, template), manifest);
  assert.throws(
    () => validateBaselineManifest({
      ...manifest,
      files: [{ ...manifest.files[0], path: '../outside.py' }],
    }, template),
    /Invalid Baseline manifest path/,
  );
});

test('Task Hub preview accepts text contracts and rejects model binaries', () => {
  assert.equal(isTaskFilePreviewable({ path: 'README.md' }), true);
  assert.equal(isTaskFilePreviewable({ path: 'src/model.py' }), true);
  assert.equal(isTaskFilePreviewable({ path: 'config/training.yaml' }), true);
  assert.equal(taskFilePreviewLanguage({ path: 'src/model.py' }), 'python');
  assert.equal(taskFilePreviewLanguage({ path: 'README.md' }), 'markdown');
  assert.equal(isTaskFilePreviewable({ path: 'models/global.pt' }), false);
});

test('usage series fills missing days without exposing downloader identity', () => {
  const daily = buildTaskUsageSeries({
    days: 3,
    now: new Date('2026-07-27T12:00:00Z'),
    downloadsByDay: [{ date: '2026-07-26', count: 4 }],
    approvalsByDay: [{ date: '2026-07-27', count: 2 }],
  });
  assert.deepEqual(daily, [
    { date: '2026-07-25', downloads: 0, approvedJoins: 0 },
    { date: '2026-07-26', downloads: 4, approvedJoins: 0 },
    { date: '2026-07-27', downloads: 0, approvedJoins: 2 },
  ]);
  assert.equal(JSON.stringify(daily).includes('userId'), false);
});
