import mongoose, { Schema } from 'mongoose';

const RegisteredModelSchema = new Schema({
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
  visibility: {
    type: String,
    enum: ['inherit', 'private', 'public'],
    default: 'inherit',
  },
  latestVersionId: {
    type: Schema.Types.ObjectId,
    ref: 'ModelVersion',
  },
  aliases: {
    latest: {
      type: Schema.Types.ObjectId,
      ref: 'ModelVersion',
    },
    best: {
      type: Schema.Types.ObjectId,
      ref: 'ModelVersion',
    },
    champion: {
      type: Schema.Types.ObjectId,
      ref: 'ModelVersion',
    },
  },
}, {
  timestamps: true,
});

RegisteredModelSchema.index({ taskId: 1, name: 1 }, { unique: true });
RegisteredModelSchema.index({ taskId: 1, updatedAt: -1 });

const RegisteredModel = mongoose.model(
  'RegisteredModel',
  RegisteredModelSchema,
  'fl.registered_model',
);

export default RegisteredModel;
