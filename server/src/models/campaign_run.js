import mongoose, { Schema } from 'mongoose';

const CampaignRunSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  runtimeKey: { type: String, required: true },
  releaseId: { type: String, required: true },
  status: {
    type: String,
    enum: ['starting', 'running', 'completed', 'failed', 'stopped'],
    default: 'starting',
  },
  campaign: {
    schemaVersion: Number,
    rounds: Number,
    clientsPerRound: Number,
    serverEvaluation: { type: Schema.Types.Mixed },
    strategy: {
      name: String,
      parameters: { type: Schema.Types.Mixed },
    },
  },
  baseGlobalModelVersion: { type: Number, default: 0 },
  targetGlobalModelVersion: { type: Number, required: true },
  startedAt: Date,
  endedAt: Date,
  failure: String,
}, { timestamps: true });

CampaignRunSchema.index({ taskId: 1, createdAt: -1 });
CampaignRunSchema.index({ taskId: 1, targetGlobalModelVersion: -1 });

const CampaignRun = mongoose.model('CampaignRun', CampaignRunSchema, 'fl.campaign_run');

export default CampaignRun;
