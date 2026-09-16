import mongoose, { Schema } from 'mongoose';

const TaskFileSchema = new Schema({
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  version: {
    type: Number,
    required: true,
    min: 1,
  },
  artifactKey: {
    type: String,
    required: true,
  },
  fileName: String,
  contentType: String,
  size: Number,
  checksum: String,
  kind: {
    type: String,
    enum: ['documentation', 'model_code', 'data_preparation', 'config', 'other'],
    default: 'other',
  },
  source: {
    type: String,
    enum: ['default_baseline', 'owner', 'launcher'],
    default: 'owner',
  },
  templateName: String,
  templateVersion: String,
  templateRevision: Number,
  templatePath: String,
  status: {
    type: String,
    enum: ['ready', 'archived', 'failed'],
    default: 'ready',
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

TaskFileSchema.index({ taskId: 1, path: 1, version: 1 }, { unique: true });
TaskFileSchema.index({ taskId: 1, path: 1, createdAt: -1 });
TaskFileSchema.index({ artifactKey: 1 }, { unique: true });

const TaskFile = mongoose.model('TaskFile', TaskFileSchema, 'fl.task_file');

export default TaskFile;
