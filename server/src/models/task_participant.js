import mongoose, { Schema } from 'mongoose';

const TaskParticipantSchema = new Schema({
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userHandle: String,
  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'revoked', 'left'],
    default: 'requested',
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: Date,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  completedParticipationCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  approvalParticipationBaseline: {
    type: Number,
    default: 0,
    min: 0,
  },
  completedRunIds: {
    type: [String],
    default: [],
    select: false,
  },
  lastStartedAt: Date,
  lastParticipatedAt: Date,
  leftAt: Date,
}, {
  timestamps: true,
});

TaskParticipantSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskParticipantSchema.index({ taskId: 1, status: 1, requestedAt: -1 });

const TaskParticipant = mongoose.model(
  'TaskParticipant',
  TaskParticipantSchema,
  'fl.task_participant',
);

export default TaskParticipant;
