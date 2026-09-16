import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/user.js';
import Task from '../src/models/task.js';
import { defaultUserHandle, slugify } from '../src/lib/slugs.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const uniqueValue = (base, used, maxLength = 64) => {
  let candidate = base.slice(0, maxLength);
  let suffix = 2;
  while (used.has(candidate)) {
    const ending = `-${suffix}`;
    candidate = `${base.slice(0, maxLength - ending.length)}${ending}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

const plainSummary = (value = '') => String(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 280);

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

  const users = await User.find({}).sort({ _id: 1 });
  const usedHandles = new Set(
    users.map((user) => user.handle).filter(Boolean),
  );
  const userUpdates = [];
  const userById = new Map();

  for (const user of users) {
    let handle = user.handle;
    if (!handle) {
      handle = uniqueValue(defaultUserHandle(user), usedHandles, 30);
      userUpdates.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              handle,
              displayName: user.displayName
                || [user.firstName, user.lastName].filter(Boolean).join(' ')
                || handle,
            },
          },
        },
      });
    }
    userById.set(String(user._id), {
      _id: user._id,
      handle,
    });
  }

  const tasks = await Task.find({}).sort({ _id: 1 });
  const usedSlugsByOwner = new Map();
  const taskUpdates = [];
  const taskBackfillReasons = {};
  let missingOwners = 0;

  for (const task of tasks) {
    const ownerId = task.ownerId || task.user?._id;
    const owner = ownerId ? userById.get(String(ownerId)) : null;
    if (!owner) {
      missingOwners += 1;
      continue;
    }

    const ownerKey = String(owner._id);
    if (!usedSlugsByOwner.has(ownerKey)) {
      usedSlugsByOwner.set(ownerKey, new Set());
    }
    const usedSlugs = usedSlugsByOwner.get(ownerKey);
    const baseSlug = task.slug || slugify(task.title, `task-${String(task._id).slice(-6)}`);
    const slug = uniqueValue(baseSlug, usedSlugs);
    const originalDate = task.publishedDate || new Date();

    const desired = {
      ownerId: owner._id,
      ownerHandle: owner.handle,
      slug,
      runtimeKey: task.runtimeKey || task.title,
      // 기존 Task는 의도치 않은 공개를 막기 위해 모두 private로 전환한다.
      visibility: task.visibility === 'public' ? 'public' : 'private',
      participationPolicy: task.participationPolicy || 'approval_required',
      summary: task.summary
        || plainSummary(task.description)
        || task.title,
      createdAt: task.createdAt || originalDate,
      updatedAt: task.updatedAt || originalDate,
    };
    const reasons = [
      String(task.ownerId || '') !== String(desired.ownerId) && 'ownerId',
      task.ownerHandle !== desired.ownerHandle && 'ownerHandle',
      task.slug !== desired.slug && 'slug',
      task.runtimeKey !== desired.runtimeKey && 'runtimeKey',
      task.visibility !== desired.visibility && 'visibility',
      task.participationPolicy !== desired.participationPolicy && 'participationPolicy',
      task.summary !== desired.summary && 'summary',
      !task.createdAt && 'createdAt',
      !task.updatedAt && 'updatedAt',
    ].filter(Boolean);
    const needsBackfill = reasons.length > 0;
    for (const reason of reasons) {
      taskBackfillReasons[reason] = (taskBackfillReasons[reason] || 0) + 1;
    }

    if (needsBackfill) {
      taskUpdates.push({
        updateOne: {
          filter: { _id: task._id },
          update: {
            $set: desired,
          },
        },
      });
    }
  }

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    users: users.length,
    usersToBackfill: userUpdates.length,
    tasks: tasks.length,
    tasksToBackfill: taskUpdates.length,
    taskBackfillReasons,
    tasksSkippedMissingOwner: missingOwners,
    publicTasksAfterMigration: tasks.filter((task) => task.visibility === 'public').length,
  };
  console.log(JSON.stringify(report, null, 2));

  if (apply) {
    if (userUpdates.length) await User.bulkWrite(userUpdates, { ordered: true });
    // Mongoose timestamps는 기존 문서의 createdAt을 immutable로 취급할 수 있으므로
    // legacy timestamp backfill은 native collection bulkWrite로 수행한다.
    if (taskUpdates.length) await Task.collection.bulkWrite(taskUpdates, { ordered: true });
    await Promise.all([User.createIndexes(), Task.createIndexes()]);
    const [
      usersMissingHandle,
      tasksMissingAccessFields,
      privateTasks,
      publicTasks,
    ] = await Promise.all([
      User.countDocuments({ handle: { $in: [null, ''] } }),
      Task.countDocuments({
        $or: [
          { ownerId: { $exists: false } },
          { ownerHandle: { $in: [null, ''] } },
          { slug: { $in: [null, ''] } },
          { runtimeKey: { $in: [null, ''] } },
          { visibility: { $nin: ['private', 'public'] } },
          { participationPolicy: { $exists: false } },
          { createdAt: { $exists: false } },
          { updatedAt: { $exists: false } },
        ],
      }),
      Task.countDocuments({ visibility: 'private' }),
      Task.countDocuments({ visibility: 'public' }),
    ]);
    console.log(JSON.stringify({
      verification: {
        usersMissingHandle,
        tasksMissingAccessFields,
        privateTasks,
        publicTasks,
      },
    }, null, 2));
    console.log('Task access migration applied successfully.');
  } else {
    console.log('No data changed. Re-run with --apply after reviewing this report.');
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Task access migration failed:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
