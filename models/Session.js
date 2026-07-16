import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
