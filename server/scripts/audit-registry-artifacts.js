import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { listRegistryFiles } from '../src/integrations/registryApi.js';
import ModelVersion from '../src/models/model_version.js';
import Task from '../src/models/task.js';
import TaskRelease from '../src/models/task_release.js';

dotenv.config();

const fileNames = (payload) => {
  const entries = Array.isArray(payload)
    ? payload
    : (payload?.files || payload?.items || []);
  return entries
    .map((entry) => (typeof entry === 'string' ? entry : entry?.filename || entry?.name))
    .filter((name) => typeof name === 'string' && name.length > 0)
    .sort();
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  if (!process.env.REGISTRY_API_BASE_URL) throw new Error('REGISTRY_API_BASE_URL is required.');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });

  const tasks = await Task.find({}).select('_id title').lean();
  const report = {
    mode: 'read-only',
    taskCount: tasks.length,
    checkedNamespaces: ['task-assets', 'global-models'],
    unreferenced: [],
    errors: [],
  };

  for (const task of tasks) {
    const taskId = String(task._id);
    const [releases, models] = await Promise.all([
      TaskRelease.find({ taskId: task._id }).select('bundleName').lean(),
      ModelVersion.find({
        taskId: task._id,
        storageBackend: 'registry_api',
      }).select('registryFileName').lean(),
    ]);
    const referenced = {
      'task-assets': new Set(releases.map((item) => item.bundleName).filter(Boolean)),
      'global-models': new Set(models.map((item) => item.registryFileName).filter(Boolean)),
    };

    for (const namespace of report.checkedNamespaces) {
      try {
        const payload = await listRegistryFiles({ namespace, taskId });
        for (const filename of fileNames(payload)) {
          if (!referenced[namespace].has(filename)) {
            report.unreferenced.push({ taskId, title: task.title, namespace, filename });
          }
        }
      } catch (error) {
        report.errors.push({ taskId, namespace, message: error.message });
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (report.errors.length) process.exitCode = 1;
};

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
