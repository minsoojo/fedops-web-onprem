import Task from '../../models/task.js';
import mongoose from 'mongoose';
import Joi from 'joi';
import sanitizeHtml from 'sanitize-html';
import axios from 'axios';
import { serverManagerUrl as SERVER_ST } from '../../config/serverManager.js';
import User from '../../models/user.js';
import TaskParticipant from '../../models/task_participant.js';
import RegisteredModel from '../../models/registered_model.js';
import ModelVersion from '../../models/model_version.js';
import TaskFile from '../../models/task_file.js';
import ModelDownloadEvent from '../../models/model_download_event.js';
import CampaignRun from '../../models/campaign_run.js';
import { slugify, defaultUserHandle } from '../../lib/slugs.js';
import { ownerHandleFilter } from '../../lib/taskHandles.js';
import {
  canManageTask,
  canViewTask,
  effectiveVisibility,
  isAdmin,
  isPubliclyDiscoverableTask,
  isTaskOwner,
  publicRegistryFilter,
  toAuthorizedTask,
  toPublicTask,
} from '../../lib/taskAccess.js';
import { loadTaskActivity } from '../../lib/taskActivity.js';
import { loadTaskMonitoring } from '../../lib/taskMonitoring.js';
import { buildDefaultTaskCard } from '../../lib/taskCard.js';
import { getBundledBaselineTemplate } from '../../lib/bundledBaseline.js';
import {
  buildDefaultTaskRuntimeContract,
  buildLegacyTaskRuntimeContract,
} from '../../lib/taskRuntimeContract.js';
import {
  selectTaskModification,
  taskModificationMode,
} from '../../lib/taskModification.js';
import {
  completedParticipationCount,
  participantLeavePolicy,
  participantReviewPolicy,
} from '../../lib/taskParticipation.js';

const { ObjectId } = mongoose.Types;

// FL Server configuration

const sanitizeOption = {
  allowedTags: [
    'h1',
    'h2',
    'b',
    'i',
    'u',
    's',
    'p',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    img: ['src'],
    li: ['class'],
  },
  allowedSchemes: ['data', 'http'],
};

export const getTaskByTitle = async (ctx, next) => {
  const { title } = ctx.params;
  // if (!ObjectId.isValid(title)) {
  //   ctx.status = 400; // Bad Request
  //   return;
  // }
  try {
    const task = await Task.findBytitle(title);
    // Task가 존재하지 않을 때
    if (!task) {
      ctx.status = 404; // Not Found
      return;
    }
    ctx.state.task = task;
    return next();
  } catch (e) {
    console.log("타이틀로 task를 찾지 못하였음.")
    ctx.throw(500, e);
  }
};

export const getTaskById = async (ctx, next) => {
  const { taskId } = ctx.params;
  if (!ObjectId.isValid(taskId)) {
    ctx.status = 404;
    ctx.body = { message: 'Federated Task not found.' };
    return;
  }
  try {
    const task = await Task.findById(taskId);
    if (!task) {
      ctx.status = 404;
      ctx.body = { message: 'Federated Task not found.' };
      return;
    }
    ctx.state.task = task;
    return next();
  } catch (error) {
    ctx.throw(500, error);
  }
};

export const checkOwnTask = (ctx, next) => {
  const { user, task } = ctx.state;
  if (!canManageTask(user, task)) {
    ctx.status = 403;
    ctx.body = { message: 'Only the task owner can manage this task.' };
    return;
  }
  return next();
};


/*
    POST /api/tasks
    {
      title: '제목',
      description: '내용',
      tags: ['태그1', '태그2']
    }
*/
export const create = async (ctx) => {
  const titleRegex = /^[a-z0-9]+$/; // Regex for English letters only
  const schema = Joi.object().keys({
    title: Joi.string().required().regex(titleRegex, 'Special letter and Space is not allowed in title'),
    description: Joi.string(),
    tags: Joi.string(),
    serverRepoAddr: Joi.string()
      .uri()
      .pattern(/\.git$/)
      .required()
      .error(new Error('serverRepoAddr is not satisfied'))
  });


  // 검증하고 나서 검증 실패인 경우 에러 처리
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 409; // 타이틀 또는 서버 주소의 요구조건 X
    ctx.body = result.error.message; // bad request
    console.log("task create fail error message : ", result.error.message);
    console.log("task create fail context body : ", ctx.body);
    return;
  }

  const { title, description, tags, serverRepoAddr } = ctx.request.body;
  try {
    // task title이 이미 존재하는지 확인
    const exists = await Task.findBytitle(title);
    if (exists) {
      ctx.status = 409;
      ctx.body = "task title is already exist"; // Conflict
      return;
    }

    const baselineTemplate = getBundledBaselineTemplate();
    const task = new Task({
      title,
      baselineTemplate: {
        ...baselineTemplate,
        status: 'ready',
      },
      runtimeContract: buildLegacyTaskRuntimeContract(),
      description: sanitizeHtml(description, sanitizeOption),
      tags,
      serverRepoAddr,
      user: ctx.state.user,
    });
    await task.save();
    ctx.body = task;
  } catch (e) {
    ctx.throw(500, e);
  }
};

/*
    POST /api/tasks/newcreate
    {
      title: '제목',
      description: '내용',
      tags: ['태그1', '태그2']
    }
*/
export const newcreate = async (ctx) => {
  const titleRegex = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
  const schema = Joi.object().keys({
    title: Joi.string().allow('').regex(titleRegex, 'Use lowercase letters, numbers, and hyphens'),
    creationMode: Joi.string().valid('legacy', 'federated-task-v3').default('legacy'),
    displayName: Joi.string().trim().max(100).allow(''),
    registrySlug: Joi.string().trim().max(64).allow(''),
    primaryModelName: Joi.string().trim().max(120).allow(''),
    taskCategory: Joi.string().trim().max(40).allow(''),
    dataModality: Joi.string().valid(
      'undecided', 'image', 'tabular', 'timeseries', 'text', 'multimodal',
    ).allow(''),
    description: Joi.string().allow(''), // 빈 문자열 허용
    tags: Joi.string().allow(''),
    serverRepoAddr: Joi.string().allow(''),
    // .uri()
    // .pattern(/\.git$/)
    // .required()
    // .error(new Error('serverRepoAddr is not satisfied')),
    // 연합학습 설정 파라미터들
    dataType: Joi.string().valid('Image', 'LLM', 'Numeric').allow(''),
    modelType: Joi.string().allow(''),
    learningRate: Joi.string().allow(''),
    numEpochs: Joi.string().allow(''),
    batchSize: Joi.string().allow(''),
    numRounds: Joi.string().allow(''),
    clientPerRound: Joi.string().allow(''),
    strategy: Joi.string().allow(''),
    strategyParams: Joi.object().allow(null),
    xaiEnabled: Joi.string().allow(''),
    xaiParams: Joi.object().allow(null),
    llmParams: Joi.object().allow(null),
    datasetParams: Joi.object().allow(null),
    clusteringEnabled: Joi.string().allow(''),
    clusteringParams: Joi.object().allow(null),
    sbaFlTarget: Joi.string().valid('weight', 'steps').allow(''),
    yamlConfig: Joi.string().allow(''),
    summary: Joi.string().allow('').max(280),
    visibility: Joi.string().valid('private', 'public').default('private'),
    participationPolicy: Joi.string()
      .valid('closed', 'approval_required', 'open')
      .default('approval_required'),
  });


  // 검증하고 나서 검증 실패인 경우 에러 처리
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 409; // 타이틀 또는 서버 주소의 요구조건 X
    ctx.body = result.error.message; // bad request
    console.log("task create fail error message : ", result.error.message);
    console.log("task create fail context body : ", ctx.body);
    return;
  }

  const {
    title,
    description,
    tags,
    dataType,
    modelType,
    learningRate,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    xaiEnabled,
    xaiParams,
    llmParams,
    datasetParams,
    clusteringEnabled,
    clusteringParams,
    sbaFlTarget,
    yamlConfig,
    summary,
    visibility,
    participationPolicy,
    creationMode,
    displayName,
    registrySlug,
    primaryModelName,
    taskCategory,
    dataModality,
  } = result.value;

  const modernDraft = creationMode === 'federated-task-v3' && modelType !== 'SBA-FL';
  if (modernDraft && !String(displayName || '').trim()) {
    ctx.status = 409;
    ctx.body = 'Federated Task name is required.';
    return;
  }
  if (!modernDraft && !title) {
    ctx.status = 409;
    ctx.body = 'Task title is required.';
    return;
  }

  if (modelType === 'SBA-FL' && !isAdmin(ctx.state.user)) {
    ctx.status = 403;
    ctx.body = 'SBA-FL task creation is only allowed for admin.';
    return;
  }
  if (modelType === 'SBA-FL' && visibility === 'public') {
    ctx.status = 400;
    ctx.body = 'SBA-FL tasks must remain private.';
    return;
  }

  try {
    const owner = await User.findById(ctx.state.user._id);
    if (!owner) {
      ctx.status = 401;
      ctx.body = { message: 'User account not found.' };
      return;
    }
    const ownerHandle = owner.handle || defaultUserHandle(owner);
    if (!owner.handle) {
      owner.handle = ownerHandle;
      owner.displayName = owner.displayName
        || [owner.firstName, owner.lastName].filter(Boolean).join(' ')
        || ownerHandle;
      await owner.save();
    }

    const objectId = new ObjectId();
    const safeDisplayName = String(displayName || title).trim();
    const safeSlug = slugify(registrySlug || safeDisplayName || title, `task-${Date.now()}`);
    let runtimeKey = title;
    if (modernDraft) {
      const duplicate = await Task.exists({ ownerId: owner._id, slug: safeSlug });
      if (duplicate) {
        ctx.status = 409;
        ctx.body = 'This Registry ID is already used by your account.';
        return;
      }
      const prefix = slugify(`${ownerHandle}-${safeSlug}`, 'fedops-task').slice(0, 54);
      runtimeKey = `${prefix}-${String(objectId).slice(-6)}`;
    } else {
      const exists = await Task.findBytitle(title);
      if (exists) {
        ctx.status = 409;
        ctx.body = 'task title is already exist';
        return;
      }
    }

    const safeSummary = sanitizeHtml(
      summary || description || safeDisplayName || 'Federated Task Draft',
      { allowedTags: [], allowedAttributes: {} },
    ).slice(0, 280);
    const baselineTemplate = getBundledBaselineTemplate();
    const task = new Task({
      _id: objectId,
      title: runtimeKey,
      displayName: safeDisplayName,
      runtimeKey,
      baselineTemplate: {
        ...baselineTemplate,
        status: 'ready',
      },
      runtimeContract: modernDraft
        ? buildDefaultTaskRuntimeContract(baselineTemplate)
        : buildLegacyTaskRuntimeContract(),
      slug: safeSlug,
      creationMode: modernDraft ? 'federated-task-v3' : 'legacy',
      taskCategory: modernDraft ? taskCategory || null : null,
      dataModality: modernDraft ? dataModality || 'undecided' : null,
      primaryModel: modernDraft ? {
        workingName: primaryModelName || safeDisplayName,
      } : undefined,
      description: sanitizeHtml(
        description || 'Auto-generated task from FedOps platform',
        sanitizeOption,
      ),
      summary: safeSummary,
      tags: tags || '',
      serverRepoAddr: '',
      user: {
        _id: owner._id,
        username: owner.username,
      },
      ownerId: owner._id,
      ownerHandle,
      visibility,
      participationPolicy,
      registryStatus: 'draft',
      // 연합학습 설정 파라미터들 추가
      dataType: modernDraft
        ? (modelType === 'LLM'
          ? 'LLM'
          : ({ image: 'Image', tabular: 'Numeric', timeseries: 'Numeric', multimodal: 'Numeric', text: 'Text' }[dataModality] || undefined))
        : dataType,
      modelType: modernDraft ? (modelType === 'LLM' ? 'LLM' : 'AI') : modelType,
      learningRate: modernDraft ? undefined : learningRate,
      numEpochs: modernDraft ? undefined : numEpochs,
      batchSize: modernDraft ? undefined : batchSize,
      numRounds: modernDraft ? undefined : numRounds,
      clientPerRound: modernDraft ? undefined : clientPerRound,
      strategy: modernDraft ? undefined : strategy,
      strategyParams: modernDraft ? undefined : strategyParams,
      xaiEnabled: modernDraft ? undefined : xaiEnabled,
      xaiParams: modernDraft ? undefined : xaiParams,
      llmParams: modernDraft ? undefined : llmParams,
      datasetParams: modernDraft ? undefined : datasetParams,
      clusteringEnabled: modernDraft ? undefined : clusteringEnabled,
      clusteringParams: modernDraft ? undefined : clusteringParams,
      sbaFlTarget,
      yamlConfig: modernDraft ? '' : yamlConfig,
    });
    task.cardMarkdown = buildDefaultTaskCard(task);

    await task.save();

    // Draft 생성은 Kubernetes runtime을 자동으로 시작하지 않는다.
    // Owner가 Server Management에서 명시적으로 시작해야 한다.
    ctx.status = 201;
    ctx.body = await toAuthorizedTask(task, ctx.state.user);
  } catch (e) {
    ctx.throw(500, e);
  }
};

// html을 없애고 내용이 너무 길면 200자로 제한하는 함수
const removeHtmlAndShorten = (description = '') => {
  const filtered = sanitizeHtml(description || '', {
    allowedTags: [],
  });
  return filtered.length < 200 ? filtered : `${filtered.slice(0, 200)}...`;
};

/*
    GET /api/tasks?username=&tag=&page=
*/
export const list = async (ctx) => {
  // query는 문자열이기 때문에 숫자로 변환해 주어야 함.
  // 값이 주어지지 않았다면 1을 기본으로 사용.
  const page = parseInt(ctx.query.page || '1', 10);

  if (page < 1) {
    ctx.status = 400;
    return;
  }

  const { tag, visibility } = ctx.query;
  const scope = ['all', 'owned', 'joined'].includes(ctx.query.scope)
    ? ctx.query.scope
    : 'all';
  const { user } = ctx.state; // Get the user from the state
  const ownerConditions = [
    { ownerId: new ObjectId(user._id) },
    { 'user._id': new ObjectId(user._id) },
    { 'user.username': user.username },
  ];
  const joinedTaskIds = scope === 'owned'
    ? []
    : await TaskParticipant.find({
      userId: user._id,
      status: 'approved',
    }).distinct('taskId');

  let accessQuery;
  if (scope === 'owned') {
    accessQuery = { $or: ownerConditions };
  } else if (scope === 'joined') {
    accessQuery = { _id: { $in: joinedTaskIds } };
  } else {
    accessQuery = {
      $or: [
        ...ownerConditions,
        { _id: { $in: joinedTaskIds } },
      ],
    };
  }

  const query = {
    ...(tag ? { tags: tag } : {}),
    ...(visibility && ['private', 'public'].includes(visibility)
      ? { visibility }
      : {}),
    ...accessQuery,
  };

  try {
    const tasks = await Task.find(query)
      .sort({ _id: -1 })
      .limit(10)
      .skip((page - 1) * 10)
      .lean()
      .exec();
    const taskCount = await Task.countDocuments(query).exec();
    ctx.set('Last-Page', Math.ceil(taskCount / 10));
    ctx.body = await Promise.all(tasks.map(async (task) => {
      const owned = isTaskOwner(user, task);
      return {
        ...await toAuthorizedTask(task, user),
        description: removeHtmlAndShorten(task.description),
        membership: {
          role: owned ? 'owner' : 'participant',
          status: owned ? 'owner' : 'approved',
        },
      };
    }));
  } catch (e) {
    ctx.throw(500, e);
  }
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
    GET /api/tasks/public?q=&modelType=&tag=&page=
*/
export const listPublic = async (ctx) => {
  const page = parseInt(ctx.query.page || '1', 10);
  if (page < 1) {
    ctx.status = 400;
    return;
  }

  const pageSize = 12;
  const { q, modelType, tag } = ctx.query;
  if (modelType === 'SBA-FL') {
    ctx.set('Last-Page', '0');
    ctx.body = [];
    return;
  }
  const query = {
    ...publicRegistryFilter(),
    ...(modelType ? { modelType } : {}),
    ...(tag ? { tags: { $regex: escapeRegExp(tag), $options: 'i' } } : {}),
  };
  if (q) {
    const search = { $regex: escapeRegExp(q), $options: 'i' };
    query.$and = [
      { $or: query.$or },
      { $or: [
        { title: search },
        { displayName: search },
        { 'primaryModel.displayName': search },
        { 'primaryModel.workingName': search },
        { summary: search },
        { description: search },
        { tags: search },
        { ownerHandle: search },
      ] },
    ];
    delete query.$or;
  }

  try {
    const tasks = await Task.find(query)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(pageSize)
      .skip((page - 1) * pageSize)
      .lean()
      .exec();
    const taskCount = await Task.countDocuments(query).exec();
    ctx.set('Last-Page', Math.ceil(taskCount / pageSize));
    ctx.body = await Promise.all(
      tasks.map((task) => toPublicTask(task, ctx.state.user)),
    );
  } catch (e) {
    ctx.throw(500, e);
  }
};

/*
    GET /api/tasks/public/:handle/:slug
*/
export const readPublic = async (ctx) => {
  const task = await Task.findOne({
    ...publicRegistryFilter(),
    ...ownerHandleFilter(ctx.params.handle),
    slug: ctx.params.slug,
  });
  if (!task) {
    ctx.status = 404;
    return;
  }
  ctx.body = await toPublicTask(task, ctx.state.user);
};

export const readPublicActivity = async (ctx) => {
  const task = await Task.findOne({
    ...publicRegistryFilter(),
    ...ownerHandleFilter(ctx.params.handle),
    slug: ctx.params.slug,
  });
  if (!task) {
    ctx.status = 404;
    return;
  }
  try {
    ctx.body = await loadTaskActivity(task, ctx.state.user);
  } catch (error) {
    console.error('Public task activity error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to load task activity.' };
  }
};

/*
    GET /api/tasks/:id
*/
export const read = async (ctx) => {
  if (!await canViewTask(ctx.state.user, ctx.state.task)) {
    ctx.status = ctx.state.user ? 403 : 401;
    ctx.body = { message: 'You do not have access to this task.' };
    return;
  }
  ctx.body = await toAuthorizedTask(ctx.state.task, ctx.state.user);
};

export const readActivity = async (ctx) => {
  if (!await canViewTask(ctx.state.user, ctx.state.task)) {
    ctx.status = ctx.state.user ? 403 : 401;
    ctx.body = { message: 'You do not have access to this task.' };
    return;
  }
  try {
    ctx.body = await loadTaskActivity(ctx.state.task, ctx.state.user);
  } catch (error) {
    console.error('Task activity error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to load task activity.' };
  }
};

export const readMonitoring = async (ctx) => {
  try {
    ctx.body = await loadTaskMonitoring(
      ctx.state.task,
      ctx.state.user,
      ctx.query,
    );
  } catch (error) {
    console.error('Task monitoring error:', error);
    ctx.status = 500;
    ctx.body = { message: 'Failed to load task monitoring data.' };
  }
};

export const updateTaskCard = async (ctx) => {
  if (ctx.state.task.registryStatus === 'published') {
    ctx.status = 409;
    ctx.body = {
      message: 'A Published Task Card comes from the immutable Release README. Submit a new Release to change it.',
    };
    return;
  }
  const schema = Joi.object({
    markdown: Joi.string().allow('').max(100_000).required(),
  });
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
    ctx.body = { message: result.error.message };
    return;
  }
  ctx.state.task.cardMarkdown = result.value.markdown.trim()
    || buildDefaultTaskCard(ctx.state.task);
  await ctx.state.task.save();
  ctx.body = {
    cardMarkdown: ctx.state.task.cardMarkdown,
    updatedAt: ctx.state.task.updatedAt,
  };
};

export const requestParticipation = async (ctx) => {
  const { user, task } = ctx.state;
  if (isTaskOwner(user, task)) {
    ctx.status = 409;
    ctx.body = { message: 'The task owner does not need to request participation.' };
    return;
  }
  if (!isPubliclyDiscoverableTask(task)) {
    ctx.status = 404;
    return;
  }
  if (task.participationPolicy === 'closed') {
    ctx.status = 403;
    ctx.body = { message: 'This task is not accepting participants.' };
    return;
  }

  const userInfo = await User.findById(user._id).lean();
  const status = task.participationPolicy === 'open' ? 'approved' : 'requested';
  const existing = await TaskParticipant.findOne({
    taskId: task._id,
    userId: user._id,
  }).select('completedParticipationCount').lean();
  const update = {
    $set: {
      userHandle: userInfo?.handle || user.handle || 'unknown',
      status,
      requestedAt: new Date(),
      ...(status === 'approved' ? {
        reviewedAt: new Date(),
        approvalParticipationBaseline: completedParticipationCount(existing),
      } : {}),
    },
    $unset: {
      leftAt: '',
      ...(status === 'requested' ? { reviewedAt: '', reviewedBy: '' } : {}),
    },
  };
  const participant = await TaskParticipant.findOneAndUpdate(
    { taskId: task._id, userId: user._id },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  ctx.status = 201;
  ctx.body = participant;
};

export const listParticipants = async (ctx) => {
  const participants = await TaskParticipant.find({ taskId: ctx.state.task._id })
    .select(
      'userHandle status requestedAt reviewedAt completedParticipationCount '
      + 'lastStartedAt lastParticipatedAt leftAt createdAt updatedAt',
    )
    .sort({ requestedAt: -1 })
    .lean();
  ctx.body = participants;
};

export const reviewParticipant = async (ctx) => {
  const schema = Joi.object({
    status: Joi.string().valid('approved', 'rejected', 'revoked').required(),
  });
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
    ctx.body = { message: result.error.message };
    return;
  }
  const existing = await TaskParticipant.findOne({
    _id: ctx.params.participantId,
    taskId: ctx.state.task._id,
  }).select('status completedParticipationCount');
  if (!existing) {
    ctx.status = 404;
    return;
  }
  const transition = participantReviewPolicy(existing.status, result.value.status);
  if (!transition.allowed) {
    ctx.status = 409;
    ctx.body = { message: transition.reason };
    return;
  }
  const participant = await TaskParticipant.findOneAndUpdate(
    {
      _id: ctx.params.participantId,
      taskId: ctx.state.task._id,
    },
    {
      $set: {
        status: result.value.status,
        reviewedAt: new Date(),
        reviewedBy: ctx.state.user._id,
        ...(result.value.status === 'approved' ? {
          approvalParticipationBaseline: completedParticipationCount(existing),
        } : {}),
      },
      $unset: { leftAt: '' },
    },
    { new: true },
  ).select(
    'userHandle status requestedAt reviewedAt completedParticipationCount '
    + 'lastStartedAt lastParticipatedAt leftAt createdAt updatedAt',
  );
  ctx.body = participant;
};

export const recordParticipationEvent = async (ctx) => {
  const schema = Joi.object({
    event: Joi.string().valid('started', 'completed').required(),
    runId: Joi.string().min(1).max(160).required(),
    releaseId: Joi.string().max(160).allow('', null),
  });
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
    ctx.body = { message: result.error.message };
    return;
  }
  const { user, task } = ctx.state;
  if (isTaskOwner(user, task)) {
    ctx.body = { status: 'owner', recorded: false };
    return;
  }
  const participant = await TaskParticipant.findOne({
    taskId: task._id,
    userId: user._id,
    status: 'approved',
  }).select('+completedRunIds');
  if (!participant) {
    ctx.status = 403;
    ctx.body = { message: 'Approved participation is required.' };
    return;
  }
  const now = new Date();
  if (result.value.event === 'started') {
    participant.lastStartedAt = now;
    await participant.save();
    ctx.body = { status: participant.status, event: 'started', recorded: true };
    return;
  }
  const updated = await TaskParticipant.findOneAndUpdate(
    {
      _id: participant._id,
      status: 'approved',
      completedRunIds: { $ne: result.value.runId },
    },
    {
      $inc: { completedParticipationCount: 1 },
      $set: { lastParticipatedAt: now },
      $push: {
        completedRunIds: {
          $each: [result.value.runId],
          $slice: -20,
        },
      },
    },
    { new: true },
  ).select('status completedParticipationCount lastParticipatedAt');
  ctx.body = {
    status: updated?.status || participant.status,
    event: 'completed',
    recorded: Boolean(updated),
    completedParticipationCount: Number(
      updated?.completedParticipationCount
      ?? participant.completedParticipationCount
      ?? 0,
    ),
  };
};

export const leaveParticipation = async (ctx) => {
  const { user, task } = ctx.state;
  if (isTaskOwner(user, task)) {
    ctx.status = 409;
    ctx.body = { message: 'The task owner cannot leave their own Federated Task.' };
    return;
  }
  const participant = await TaskParticipant.findOne({
    taskId: task._id,
    userId: user._id,
  });
  if (!participant) {
    ctx.status = 404;
    ctx.body = { message: 'There is no participation to leave.' };
    return;
  }
  const policy = participantLeavePolicy(participant);
  if (!policy.canLeave) {
    ctx.status = 409;
    ctx.body = { message: policy.reason };
    return;
  }
  participant.status = 'left';
  participant.leftAt = new Date();
  await participant.save();
  ctx.body = {
    participationId: String(participant._id),
    taskId: String(task._id),
    status: participant.status,
    canRejoin: task.participationPolicy !== 'closed',
    completedParticipationCount: completedParticipationCount(participant),
  };
};

/*
    DELETE /api/tasks/:id
*/
export const remove = async (ctx) => {
  const { title } = ctx.params;
  
  // 디버깅 로그 추가
  console.log('=== 🗑️ REMOVE TASK (FULL DELETE) ===');
  console.log('Purpose: Task와 K8s 리소스 모두 삭제');
  console.log('Title:', title);
  console.log('URL:', ctx.url);
  console.log('Method:', ctx.method);
  console.log('Params:', ctx.params);
  console.log('================================');

  // FastAPI(쿠버네티스 제어) 엔드포인트
  const url = `${SERVER_ST}/web-control/delete/${encodeURIComponent(title)}`;

  try {
    // 0) 존재 확인(없으면 404)
    console.log(`🔍 DB에서 Task 확인: ${title}`);
    const exists = await Task.findOne({ title }).lean();
    if (!exists) {
      console.log(`❌ Task를 찾을 수 없음: ${title}`);
      ctx.status = 404;
      ctx.body = { message: 'task not found' };
      return;
    }
    console.log(`✅ Task 발견됨:`, { _id: exists._id, title: exists.title });

    // 1) 먼저 MongoDB에서 task 삭제
    console.log('\n' + '�️'.repeat(50));
    console.log(`�️ DB 작업: Task 삭제 (전체 삭제)`);
    console.log('�️'.repeat(50));
    console.log(`🎯 Task Title: ${title}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('�️'.repeat(50));

    const deleteResult = await Task.findOneAndDelete({ title });
    
    if (deleteResult) {
      await Promise.all([
        TaskParticipant.deleteMany({ taskId: deleteResult._id }),
        RegisteredModel.deleteMany({ taskId: deleteResult._id }),
        ModelVersion.deleteMany({ taskId: deleteResult._id }),
        TaskFile.deleteMany({ taskId: deleteResult._id }),
        ModelDownloadEvent.deleteMany({ taskId: deleteResult._id }),
        CampaignRun.deleteMany({ taskId: deleteResult._id }),
      ]);
      console.log('\n' + '✅'.repeat(50));
      console.log(`✅ DB 작업: Task 삭제 완료 (전체 삭제)`);
      console.log('✅'.repeat(50));
      console.log(`🎯 Task Title: ${title}`);
      console.log(`� 삭제된 Task ID: ${deleteResult._id}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('✅'.repeat(50));
    } else {
      console.log('\n' + '⚠️'.repeat(50));
      console.log(`⚠️ DB 작업: Task 삭제 실패 - 찾을 수 없음`);
      console.log('⚠️'.repeat(50));
      console.log(`🎯 Task Title: ${title}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('⚠️'.repeat(50));
    }

    // 2) 이후 K8s 리소스 삭제 요청 (404는 무시하고 계속 진행: idempotent)
    let k8sReport = null;
    try {
      console.log('\n' + '�️'.repeat(50));
      console.log(`�️ K8s API 호출: 리소스 삭제 (전체 삭제)`);
      console.log('�️'.repeat(50));
      console.log(`📍 URL: DELETE ${url}`);
      console.log(`🎯 Task Title: ${title}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('�️'.repeat(50));

      const { data } = await axios.delete(url, {
        // FastAPI가 namespace, delete_pv 쿼리 받으면 필요 시 활성화
        // params: { namespace: 'fedops', delete_pv: true },
        timeout: 20_000,
      });
      k8sReport = data;

      console.log('\n' + '✅'.repeat(50));
      console.log(`✅ K8s 응답: 리소스 삭제 성공 (전체 삭제)`);
      console.log('✅'.repeat(50));
      console.log(`📍 URL: DELETE ${url}`);
      console.log(`� Response: ${JSON.stringify(data, null, 2)}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('✅'.repeat(50));
    } catch (e) {
      const status = e?.response?.status;
      console.log('\n' + '❌'.repeat(50));
      console.log(`❌ K8s 에러: 리소스 삭제 실패 (전체 삭제)`);
      console.log('❌'.repeat(50));
      console.log(`📍 URL: DELETE ${url}`);
      console.log(`📊 Status: ${status}`);
      console.log(`❌ Error: ${e.message}`);
      console.log(`📤 Response: ${JSON.stringify(e?.response?.data, null, 2)}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('❌'.repeat(50));
      
      // 404면 이미 지워진 것으로 간주하고 계속 진행
      if (status !== 404) {
        // 다른 에러는 사용자에게 그대로 전달
        throw e;
      }
      k8sReport = { ok: true, note: 'k8s resources not found; treated as deleted' };
    }

    // 3) 프론트 확인용 리포트 반환(200)
    ctx.status = 200;
    ctx.body = {
      ok: true,
      title,
      k8sReport,
    };
  } catch (e) {
    console.error(`[DELETE][${title}]`, e?.response?.data || e.message);
    ctx.throw(500, e);
  }
};

// only delete k8s
export const removek8s = async (ctx) => {
  const { title } = ctx.params;
  
  // 디버깅 로그 추가
  console.log('=== 🗑️ REMOVE K8S ONLY ===');
  console.log('Purpose: K8s 리소스만 삭제 (DB Task 유지)');
  console.log('Title:', title);
  console.log('URL:', ctx.url);
  console.log('Method:', ctx.method);
  console.log('=======================');

  // FastAPI(쿠버네티스 제어) 엔드포인트
  const url = `${SERVER_ST}/web-control/delete/${encodeURIComponent(title)}`;

  try {
    // 0) 존재 확인(없으면 404)
    const exists = await Task.findOne({ title }).lean();
    if (!exists) {
      ctx.status = 404;
      ctx.body = { message: 'task not found' };
      return;
    }

    // 1) K8s 리소스 삭제 요청 (404는 무시하고 계속 진행: idempotent)
    let k8sReport = null;
    try {
      console.log('\n' + '🗑️'.repeat(50));
      console.log(`🗑️ K8s API 호출: 리소스 삭제 (K8s만)`);
      console.log('🗑️'.repeat(50));
      console.log(`📍 URL: DELETE ${url}`);
      console.log(`🎯 Task Title: ${title}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('🗑️'.repeat(50));

      const { data } = await axios.delete(url, {
        // FastAPI가 namespace, delete_pv 쿼리 받으면 필요 시 활성화
        // params: { namespace: 'fedops', delete_pv: true },
        timeout: 20_000,
      });
      k8sReport = data;

      console.log('\n' + '✅'.repeat(50));
      console.log(`✅ K8s 응답: 리소스 삭제 성공 (K8s만)`);
      console.log('✅'.repeat(50));
      console.log(`📍 URL: DELETE ${url}`);
      console.log(`📤 Response: ${JSON.stringify(data, null, 2)}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('✅'.repeat(50));
    } catch (e) {
      const status = e?.response?.status;
      console.log('\n' + '❌'.repeat(50));
      console.log(`❌ K8s 에러: 리소스 삭제 실패 (K8s만)`);
      console.log('❌'.repeat(50));
      console.log(`📍 URL: DELETE ${url}`);
      console.log(`📊 Status: ${status}`);
      console.log(`❌ Error: ${e.message}`);
      console.log(`📤 Response: ${JSON.stringify(e?.response?.data, null, 2)}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('❌'.repeat(50));
      
      // 404면 이미 지워진 것으로 간주하고 계속 진행
      if (status !== 404) {
        // 다른 에러는 사용자에게 그대로 전달
        throw e;
      }
      k8sReport = { ok: true, note: 'k8s resources not found; treated as deleted' };
    }

    // 3) 프론트 확인용 리포트 반환(200)
    ctx.status = 200;
    ctx.body = {
      ok: true,
      title,
      k8sReport,
    };
  } catch (e) {
    console.error(`[DELETE][${title}]`, e?.response?.data || e.message);
    ctx.throw(500, e);
  }
};

/*
    PATCH /api/tasks/:id
    {
      title: '수정',
      description: '수정 내용',
      tags: ['수정', '태그']
    }
*/
export const update = async (ctx) => {
  const { title } = ctx.params;
  const mode = taskModificationMode(ctx.state.task);
  const titleRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  const sharedFields = {
    summary: Joi.string().allow('').max(280),
    tags: Joi.string().allow(''),
    visibility: Joi.string().valid('private', 'public'),
    participationPolicy: Joi.string().valid('closed', 'approval_required', 'open'),
  };
  const v3Schema = Joi.object().keys({
    displayName: Joi.string().trim().min(1).max(100).required(),
    ...sharedFields,
  });
  const legacySchema = Joi.object().keys({
    title: Joi.string().required().regex(titleRegex, 'Use lowercase letters, numbers, and hyphens'),
    description: Joi.string(),
    ...sharedFields,
    serverRepoAddr: Joi.string()
      .uri()
      .pattern(/\.git$/)
      .allow(''),
    // 연합학습 설정 파라미터들
    dataType: Joi.string().valid('Image', 'LLM', 'Numeric'),
    modelType: Joi.string(),
    learningRate: Joi.string(),
    numEpochs: Joi.string(),
    batchSize: Joi.string(),
    numRounds: Joi.string(),
    clientPerRound: Joi.string(),
    strategy: Joi.string(),
    strategyParams: Joi.object(),
    xaiEnabled: Joi.string(),
    xaiParams: Joi.object(),
    llmParams: Joi.object(),
    datasetParams: Joi.object(),
    clusteringEnabled: Joi.string(),
    clusteringParams: Joi.object(),
    sbaFlTarget: Joi.string().valid('weight', 'steps').allow(''),
    yamlConfig: Joi.string(),
  });

  // 검증하고 나서 검증 실패인 경우 에러 처리
  const result = (mode === 'federated-task-v3' ? v3Schema : legacySchema)
    .validate(ctx.request.body, { abortEarly: false, stripUnknown: false });
  if (result.error) {
    ctx.status = 409; // 타이틀 또는 서버 주소의 요구조건 X
    ctx.body = result.error.message; // bad request
    console.log("task create fail error message : ", result.error.message);
    console.log("task create fail context body : ", ctx.body);
    return;
  }

  if (mode === 'legacy-v1' && result.value.title !== ctx.state.task.title) {
    ctx.status = 409;
    ctx.body = 'The Legacy Task ID cannot be renamed because it identifies existing runtime resources.';
    return;
  }

  const nextData = selectTaskModification(ctx.state.task, result.value);
  const nextModelType = result.value.modelType ?? ctx.state.task.modelType;
  const nextVisibility = result.value.visibility
    ?? effectiveVisibility(ctx.state.task);
  if (nextModelType === 'SBA-FL' && !isAdmin(ctx.state.user)) {
    ctx.status = 403;
    ctx.body = 'SBA-FL task management is only allowed for admin.';
    return;
  }
  if (nextModelType === 'SBA-FL' && nextVisibility === 'public') {
    ctx.status = 400;
    ctx.body = 'SBA-FL tasks must remain private.';
    return;
  }
  // description 값이 주어졌으면 HTML 필터링
  if (nextData.description) {
    nextData.description = sanitizeHtml(nextData.description, sanitizeOption);
  }
  if (nextData.summary) {
    nextData.summary = sanitizeHtml(
      nextData.summary,
      { allowedTags: [], allowedAttributes: {} },
    ).slice(0, 280);
  }
  // Visibility controls Registry discovery without rewriting Release history.
  // Keeping the publication pointer allows an owner to make the same immutable
  // Release public again later; code/model changes still require a new Release.

  try {
    const task = await Task.findOneAndUpdate({ title: title }, nextData, {
      new: true, // 이 값을 설정하면 업데이트된 데이터를 반환합니다.
      // false일 때는 업데이트되기 전의 데이터를 반환합니다.
    }).exec();
    if (!task) {
      ctx.status = 404;
      return;
    }
    ctx.body = await toAuthorizedTask(task, ctx.state.user);
  } catch (e) {
    ctx.throw(500, e);
  }
};

/* 
    POST api/tasks/notify
    {
      message: '태스크 status
    }
*/
export const notify = async (ctx) => {
  // Schema for the status update

  console.log(`pod's send : ${ctx.request.body}`);

  const task_id = ctx.request.body.task_id;
  const status = ctx.request.body.status;
  console.log(`pod's send : ${task_id} and ${status}`);

  try {
    const task = await Task.findByIdAndUpdate(task_id, { status }, {
      new: true,
    }).exec();

    if (!task) {
      ctx.status = "TASK NO";
      return;
    }

    ctx.body = task;
  } catch (e) {
    ctx.throw(500, e);
  }
};

/* 
    POST api/tasks/logs
    {
      message: '태스크 status
    }
*/
export const logs = async (ctx) => {
  // Schema for the status update

  console.log(`pod's send : ${ctx.request.body}`);

  // const task_id = ctx.request.body.task_id;
  // const status = ctx.request.body.status;
  // console.log(`pod's send : ${task_id} and ${status}`);

  // try {
  //   const task = await Task.findByIdAndUpdate(task_id, { status }, {
  //     new: true,
  //   }).exec();

  //   if (!task) {
  //     ctx.status = "TASK NO";
  //     return;
  //   }

  //   ctx.body = task;
  // } catch (e) {
  //   ctx.throw(500, e);
  // }
};
