import mongoose, { Schema } from 'mongoose';


const ReleaseFileSchema = new Schema({
  path: { type: String, required: true },
  role: String,
  contentType: String,
  size: Number,
  sha256: String,
  editable: Boolean,
  previewable: Boolean,
}, { _id: false });

const TaskReleaseSchema = new Schema({
  releaseId: { type: String, required: true, unique: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  revision: { type: Number, required: true, min: 1 },
  baseline: {
    name: String,
    version: String,
    revision: Number,
  },
  bundleName: { type: String, required: true },
  bundleSize: Number,
  bundleSha256: { type: String, required: true },
  manifestSha256: String,
  sourceFingerprint: String,
  readme: String,
  files: [ReleaseFileSchema],
  modelVersionId: { type: Schema.Types.ObjectId, ref: 'ModelVersion', required: true },
  readiness: { type: Schema.Types.Mixed },
  // Immutable Registry-facing metadata produced by Release Readiness.
  catalog: { type: Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['uploading', 'candidate', 'ready', 'published', 'rejected', 'deprecated'],
    default: 'uploading',
  },
  error: String,
  readyAt: Date,
  publishedAt: Date,
}, { timestamps: true });

TaskReleaseSchema.index({ taskId: 1, revision: 1 }, { unique: true });
TaskReleaseSchema.index({ taskId: 1, bundleSha256: 1 }, { unique: true });
TaskReleaseSchema.index({ taskId: 1, status: 1, createdAt: -1 });

const TaskRelease = mongoose.model('TaskRelease', TaskReleaseSchema, 'fl.task_release');
export default TaskRelease;
