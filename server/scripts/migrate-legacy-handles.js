import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/user.js';
import Task from '../src/models/task.js';
import TaskParticipant from '../src/models/task_participant.js';
import { defaultUserHandle, slugify } from '../src/lib/slugs.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const previousGeneratedHandle = (user) => {
  const namePart = slugify(
    [user?.firstName, user?.lastName].filter(Boolean).join('-'),
    'user',
  ).slice(0, 20);
  const idPart = String(user?._id || '').slice(-6).toLowerCase();
  return `${namePart}-${idPart}`.replace(/-+$/g, '');
};

const uniqueValue = (base, used, maxLength = 30) => {
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

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

  const users = await User.find({}).sort({ _id: 1 });
  const candidates = users.filter((user) => (
    !user.handle || user.handle === previousGeneratedHandle(user)
  ));
  const candidateIds = new Set(candidates.map((user) => String(user._id)));
  const usedHandles = new Set(
    users
      .filter((user) => !candidateIds.has(String(user._id)))
      .map((user) => user.handle)
      .filter(Boolean),
  );
  const mappings = candidates.map((user) => ({
    userId: user._id,
    oldHandle: user.handle || null,
    newHandle: uniqueValue(defaultUserHandle(user), usedHandles),
  }));
  const mappingByUserId = new Map(
    mappings.map((mapping) => [String(mapping.userId), mapping]),
  );

  const tasks = mappings.length
    ? await Task.find({
      $or: [
        { ownerId: { $in: mappings.map((mapping) => mapping.userId) } },
        { 'user._id': { $in: mappings.map((mapping) => mapping.userId) } },
      ],
    }).select('_id ownerId user._id ownerHandle').lean()
    : [];

  const taskUpdates = tasks.flatMap((task) => {
    const ownerId = task.ownerId || task.user?._id;
    const mapping = mappingByUserId.get(String(ownerId));
    if (!mapping) return [];
    const update = {
      $set: {
        ownerHandle: mapping.newHandle,
      },
    };
    if (mapping.oldHandle) {
      update.$addToSet = {
        ownerHandleAliases: mapping.oldHandle,
      };
    }
    return [{
      updateOne: {
        filter: { _id: task._id },
        update,
      },
    }];
  });

  const participantUpdates = mappings.map((mapping) => ({
    updateMany: {
      filter: { userId: mapping.userId },
      update: {
        $set: {
          userHandle: mapping.newHandle,
        },
      },
    },
  }));
  const userUpdates = mappings.map((mapping) => ({
    updateOne: {
      filter: {
        _id: mapping.userId,
        ...(mapping.oldHandle
          ? { handle: mapping.oldHandle }
          : { handle: { $in: [null, ''] } }),
      },
      update: {
        $set: {
          handle: mapping.newHandle,
        },
      },
    },
  }));

  const participantRows = mappings.length
    ? await TaskParticipant.countDocuments({
      userId: { $in: mappings.map((mapping) => mapping.userId) },
    })
    : 0;
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    users: users.length,
    legacyUsersToMigrate: mappings.length,
    taskOwnerHandlesToUpdate: taskUpdates.length,
    participantHandlesToUpdate: participantRows,
    mappings: mappings.map(({ oldHandle, newHandle }) => ({
      oldHandle,
      newHandle,
    })),
  }, null, 2));

  if (apply && mappings.length) {
    // Denormalized references are updated first. If the final user update fails,
    // a retry can still identify the original generated handle and safely resume.
    if (taskUpdates.length) {
      await Task.collection.bulkWrite(taskUpdates, { ordered: true });
    }
    if (participantUpdates.length) {
      await TaskParticipant.bulkWrite(participantUpdates, { ordered: true });
    }
    await User.bulkWrite(userUpdates, { ordered: true });
  }

  if (apply) {
    const migratedUserIds = mappings.map((mapping) => mapping.userId);
    const [remainingGeneratedHandles, staleTaskHandles, staleParticipantHandles] = mappings.length
      ? await Promise.all([
        User.countDocuments({
          _id: { $in: migratedUserIds },
          handle: { $in: mappings.map((mapping) => mapping.oldHandle).filter(Boolean) },
        }),
        Task.countDocuments({
          $or: mappings.map((mapping) => ({
            ownerId: mapping.userId,
            ownerHandle: { $ne: mapping.newHandle },
          })),
        }),
        TaskParticipant.countDocuments({
          $or: mappings.map((mapping) => ({
            userId: mapping.userId,
            userHandle: { $ne: mapping.newHandle },
          })),
        }),
      ])
      : [0, 0, 0];
    console.log(JSON.stringify({
      verification: {
        remainingGeneratedHandles,
        staleTaskHandles,
        staleParticipantHandles,
      },
    }, null, 2));
    if (remainingGeneratedHandles || staleTaskHandles || staleParticipantHandles) {
      throw new Error('Legacy handle migration verification failed.');
    }
    console.log('Legacy handle migration applied successfully.');
  } else {
    console.log('No data changed. Re-run with --apply after reviewing this report.');
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Legacy handle migration failed:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
