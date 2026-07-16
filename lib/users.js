import User from '@/models/User';

export async function findUserByWallet(walletAddress, session = null) {
  let user = await User.findOne({ walletAddress }).session(session);
  if (user) return user;

  // Existing accounts were stored before addresses were normalized.
  return User.findOne({ walletAddress: new RegExp(`^${walletAddress}$`, 'i') }).session(session);
}

export function serializeUser(user) {
  return {
    walletAddress: user.walletAddress,
    username: user.username,
    twitter: user.twitter,
    referralCode: user.referralCode,
    tickets: user.tickets,
    spinsAvailable: user.spinsAvailable,
    wonWL: user.wonWL,
    streak: user.streak,
    referrals: user.referrals,
  };
}
