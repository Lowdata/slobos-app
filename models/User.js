import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  // Handles are canonicalized by the registration route so the unique index
  // treats @Example and example as the same account.
  twitter: { type: String, default: null, unique: true, sparse: true },
  referralCode: { type: String, required: true, unique: true },
  referredBy: { type: String, default: null },
  tickets: { type: Number, default: 0 },
  spinsAvailable: { type: Number, default: 3 }, // 3 free spins initially
  wonWL: { type: Boolean, default: false },
  streak: { type: Number, default: 0 },
  lastResetDate: { type: String, default: null }, // YYYY-MM-DD
  lastPlayDate: { type: String, default: null }, // YYYY-MM-DD
  bonusEarnedToday: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
