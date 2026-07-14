import mongoose from 'mongoose';

const UserTaskSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  taskId: { type: String, required: true },
  completedAt: { type: Date, default: Date.now }
});

// Ensure a user can only complete a task once
UserTaskSchema.index({ walletAddress: 1, taskId: 1 }, { unique: true });

export default mongoose.models.UserTask || mongoose.model('UserTask', UserTaskSchema);
