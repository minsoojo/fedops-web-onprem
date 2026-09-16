import TaskParticipant from '../models/task_participant.js';
import ModelDownloadEvent from '../models/model_download_event.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

export const buildTaskUsageSeries = ({
  days = DEFAULT_DAYS,
  now = new Date(),
  downloadsByDay = [],
  approvalsByDay = [],
}) => {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const downloadMap = new Map(
    downloadsByDay.map((row) => [row.date || row._id, Number(row.count) || 0]),
  );
  const approvalMap = new Map(
    approvalsByDay.map((row) => [row.date || row._id, Number(row.count) || 0]),
  );
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end.getTime() - (days - index - 1) * DAY_MS);
    const key = dayKey(date);
    return {
      date: key,
      downloads: downloadMap.get(key) || 0,
      approvedJoins: approvalMap.get(key) || 0,
    };
  });
};

const dailyCountPipeline = (match, dateField, startAt) => ([
  {
    $match: {
      ...match,
      [dateField]: { $gte: startAt },
    },
  },
  {
    $group: {
      _id: {
        $dateToString: {
          format: '%Y-%m-%d',
          date: `$${dateField}`,
          timezone: 'UTC',
        },
      },
      count: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
]);

export const loadTaskUsage = async (task, { days = DEFAULT_DAYS } = {}) => {
  const now = new Date();
  const startAt = new Date(now.getTime() - (days - 1) * DAY_MS);
  startAt.setUTCHours(0, 0, 0, 0);
  const [
    downloads,
    approvedParticipants,
    downloadsByDay,
    reviewedApprovals,
    createdApprovals,
  ] = await Promise.all([
    ModelDownloadEvent.countDocuments({ taskId: task._id }),
    TaskParticipant.countDocuments({ taskId: task._id, status: 'approved' }),
    ModelDownloadEvent.aggregate(dailyCountPipeline(
      { taskId: task._id },
      'createdAt',
      startAt,
    )),
    TaskParticipant.aggregate(dailyCountPipeline(
      {
        taskId: task._id,
        status: 'approved',
        reviewedAt: { $type: 'date' },
      },
      'reviewedAt',
      startAt,
    )),
    TaskParticipant.aggregate(dailyCountPipeline(
      {
        taskId: task._id,
        status: 'approved',
        $or: [
          { reviewedAt: { $exists: false } },
          { reviewedAt: null },
        ],
      },
      'createdAt',
      startAt,
    )),
  ]);
  const approvalsByDay = new Map();
  [...reviewedApprovals, ...createdApprovals].forEach((row) => {
    approvalsByDay.set(row._id, (approvalsByDay.get(row._id) || 0) + row.count);
  });
  return {
    approvedParticipants,
    modelDownloads: downloads,
    windowDays: days,
    daily: buildTaskUsageSeries({
      days,
      now,
      downloadsByDay,
      approvalsByDay: [...approvalsByDay].map(([date, count]) => ({ date, count })),
    }),
    counting: {
      modelDownloads: 'explicit_download_request',
      approvedParticipants: 'current_approved_membership',
    },
  };
};

export const recordModelDownload = async ({ task, version, user }) => {
  await ModelDownloadEvent.create({
    taskId: task._id,
    modelVersionId: version._id,
    ...(user?._id ? { userId: user._id } : {}),
  });
};
