import mongoose, { Schema } from 'mongoose';

const ModelDownloadEventSchema = new Schema({
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  modelVersionId: {
    type: Schema.Types.ObjectId,
    ref: 'ModelVersion',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

ModelDownloadEventSchema.index({ taskId: 1, createdAt: -1 });
ModelDownloadEventSchema.index({ modelVersionId: 1, createdAt: -1 });
ModelDownloadEventSchema.index({ taskId: 1, userId: 1 });

const ModelDownloadEvent = mongoose.model(
  'ModelDownloadEvent',
  ModelDownloadEventSchema,
  'fl.model_download_event',
);

export default ModelDownloadEvent;
