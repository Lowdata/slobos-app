import mongoose from 'mongoose';

const LoginNonceSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  nonceHash: { type: String, required: true, unique: true },
  message: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.LoginNonce || mongoose.model('LoginNonce', LoginNonceSchema);
