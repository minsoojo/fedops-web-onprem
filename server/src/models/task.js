import mongoose, { Schema } from 'mongoose';

// const { Schema } = mongoose;

const TaskSchema = new Schema({
  title: String,
  // Human-readable Task name. `title` remains the legacy/internal route key.
  displayName: String,
  // title은 기존 Kubernetes/S3 런타임 키로 계속 사용한다.
  runtimeKey: String,
  baselineTemplate: {
    name: String,
    version: String,
    revision: Number,
    status: {
      type: String,
      enum: ['preparing', 'ready', 'failed', 'legacy'],
    },
    error: String,
    fileCount: Number,
    initializedAt: Date,
  },
  // Task 생성 당시 FL transport/runtime 계약. 기존 문서에 이 필드가 없으면
  // legacy-v1으로 해석하며 자동 migration하거나 최신 계약을 강제하지 않는다.
  runtimeContract: {
    name: {
      type: String,
      enum: ['legacy-v1', 'federated-task-v2', 'federated-task-v3'],
    },
    schemaVersion: Number,
    fedopsVersion: String,
    sourceRevision: String,
    baselineVersion: String,
  },
  slug: String,
  creationMode: {
    type: String,
    enum: ['legacy', 'federated-task-v3'],
  },
  taskCategory: String,
  dataModality: String,
  primaryModel: {
    workingName: String,
    displayName: String,
    framework: String,
    format: String,
    parameterSignatureFingerprint: String,
  },
  // Upload selection for a future Campaign; never replaces running snapshots.
  latestValidationData: {
    dataPath: String,
    sha256: String,
    fileCount: Number,
    totalBytes: Number,
    uploadedAt: Date,
  },
  campaignConfig: {
    schemaVersion: Number,
    rounds: Number,
    clientsPerRound: Number,
    serverEvaluation: { type: Schema.Types.Mixed },
    strategy: {
      name: String,
      parameters: { type: Schema.Types.Mixed },
    },
    updatedAt: Date,
  },
  // Current FedOps 1.3 execution boundary. The immutable Campaign snapshot is
  // stored in fl.campaign_run; legacy Tasks leave this field empty.
  currentCampaignRunId: String,
  description: String,
  summary: String,
  cardMarkdown: String,
  tags: String, // 문자열로 이루어진 배열
  serverRepoAddr: String,
  publishedDate: {
    type: Date,
    default: Date.now, // 현재 날짜를 기본값으로 지정
  },
  user: {
    _id: mongoose.Types.ObjectId,
    username: String,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  ownerHandle: String,
  ownerHandleAliases: [String],
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private',
  },
  participationPolicy: {
    type: String,
    enum: ['closed', 'approval_required', 'open'],
    default: 'approval_required',
  },
  publishedAt: Date,
  registryStatus: {
    type: String,
    enum: ['draft', 'ready', 'published', 'withdrawn', 'legacy'],
  },
  currentPublishedReleaseId: {
    type: String,
  },
  status: {
    type: String,
    // not_start: 파드가 생성되어 있지 않음 creating: 파드가 생성되는 중 waiting: 파드가 생성된 이후 클라이언트 대기 상태 training: 파드가 생성된 이후 학습중인 상태
    enum: ['not_start', 'creating', 'waiting', 'training'],
    default: 'not_start',
  },
  // 연합학습 설정 파라미터들
  dataType: {
    type: String,
    enum: ['Image', 'LLM', 'Numeric'],
  },
  modelType: String,
  learningRate: String,
  numEpochs: String,
  batchSize: String,
  numRounds: String,
  clientPerRound: String,
  strategy: String,
  strategyParams: {
    type: Schema.Types.Mixed, // 객체 타입
  },
  xaiEnabled: String,
  xaiParams: {
    type: Schema.Types.Mixed, // 객체 타입
  },
  llmParams: {
    type: Schema.Types.Mixed, // 객체 타입
  },
  datasetParams: {
    type: Schema.Types.Mixed, // 객체 타입
  },
  clusteringEnabled: String,
  clusteringParams: {
    type: Schema.Types.Mixed, // 객체 타입
  },
  sbaFlTarget: String,
  yamlConfig: String, // YAML 설정 텍스트
}, {
  timestamps: true,
});

TaskSchema.statics.findBytitle = function (title) {
  return this.findOne({
    $or: [
      { title },
      { runtimeKey: title },
    ],
  });
};

TaskSchema.statics.updateTask = function (title) {
  return this.findBytitle(title);
};
// TaskSchema.statics.findBytitle = function (title) {
//   return this.findOneandRemove({ title });
// };

TaskSchema.index(
  { ownerId: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ownerId: { $type: 'objectId' },
      slug: { $type: 'string' },
    },
  },
);
TaskSchema.index({ visibility: 1, publishedAt: -1, _id: -1 });
TaskSchema.index({ runtimeKey: 1 }, { sparse: true });
TaskSchema.index({ ownerHandleAliases: 1, slug: 1 });

const Task = mongoose.model('Task', TaskSchema, 'fl.task');
export default Task;
