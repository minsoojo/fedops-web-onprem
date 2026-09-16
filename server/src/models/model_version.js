import mongoose, { Schema } from 'mongoose';

const ModelVersionSchema = new Schema({
  registeredModelId: {
    type: Schema.Types.ObjectId,
    ref: 'RegisteredModel',
    required: true,
  },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  version: {
    type: Number,
    required: true,
  },
  // Registry revision and Federated Global Model version are different
  // sequences because the Initiative Model is also a Registry revision.
  globalModelVersion: Number,
  artifactKey: {
    type: String,
    required: true,
  },
  storageBackend: {
    type: String,
    enum: ['s3', 'registry_api'],
    default: 's3',
  },
  registryFileName: String,
  role: {
    type: String,
    enum: ['initial', 'global'],
  },
  origin: String,
  format: String,
  parameterSignatureFingerprint: String,
  sourceReleaseId: String,
  fileName: String,
  contentType: String,
  size: Number,
  checksum: String,
  framework: String,
  metrics: {
    type: Schema.Types.Mixed,
  },
  round: Number,
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

ModelVersionSchema.index(
  { registeredModelId: 1, version: 1 },
  { unique: true },
);
ModelVersionSchema.index({ taskId: 1, createdAt: -1 });
ModelVersionSchema.index({ artifactKey: 1 }, { unique: true });

const ModelVersion = mongoose.model(
  'ModelVersion',
  ModelVersionSchema,
  'fl.model_version',
);

export default ModelVersion;
