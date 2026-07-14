import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  rewardSpins: { type: Number, required: true },
  actionLink: { type: String }
});

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
