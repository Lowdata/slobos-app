import crypto from 'crypto';
import { getAddress, isAddress } from 'ethers';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Session from '@/models/Session';

export const SESSION_COOKIE = 'slobos_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function normalizeWalletAddress(value) {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value).toLowerCase();
}

export function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function requireUser(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (typeof token !== 'string' || token.length < 32) return null;

  await connectToDatabase();
  const session = await Session.findOne({
    tokenHash: hashValue(token),
    expiresAt: mongoose.trusted({ $gt: new Date() }),
  }).lean();

  return session?.walletAddress || null;
}
