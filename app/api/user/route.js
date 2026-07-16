import crypto from 'crypto';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { requireUser } from '@/lib/auth';
import { findUserByWallet, serializeUser } from '@/lib/users';
import User from '@/models/User';
import { NextResponse } from 'next/server';

const HANDLE_PATTERN = /^@?[A-Za-z0-9_]{1,15}$/;
const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,7}$/;
const DEFAULT_REFERRAL_REWARD_LIMIT = 100;
const parsedReferralLimit = Number.parseInt(process.env.REFERRAL_REWARD_LIMIT || '', 10);
const REFERRAL_REWARD_LIMIT = Number.isSafeInteger(parsedReferralLimit) && parsedReferralLimit >= 0
  ? parsedReferralLimit
  : DEFAULT_REFERRAL_REWARD_LIMIT;
const REFERRAL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRefCode() {
  return Array.from(
    { length: 7 },
    () => REFERRAL_ALPHABET[crypto.randomInt(REFERRAL_ALPHABET.length)],
  ).join('');
}

export async function GET(req) {
  try {
    const walletAddress = await requireUser(req);
    if (!walletAddress) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await findUserByWallet(walletAddress);
    if (!user) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    return NextResponse.json({ exists: true, user: serializeUser(user) });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const walletAddress = await requireUser(req);
    if (!walletAddress) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { twitter, referredBy } = await req.json();
    if (typeof twitter !== 'string' || !HANDLE_PATTERN.test(twitter.trim())) {
      return NextResponse.json({ error: 'Enter a valid Twitter handle' }, { status: 400 });
    }
    if (referredBy !== undefined && typeof referredBy !== 'string') {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    const normalizedReferralCode = referredBy?.trim().toUpperCase() || null;
    if (normalizedReferralCode && !REFERRAL_CODE_PATTERN.test(normalizedReferralCode)) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    await connectToDatabase();
    const existingUser = await findUserByWallet(walletAddress);
    if (existingUser) {
      return NextResponse.json(serializeUser(existingUser));
    }

    const session = await mongoose.startSession();
    let user;
    try {
      await session.withTransaction(async () => {
        const referralCode = generateRefCode();
        [user] = await User.create([{
          walletAddress,
          username: twitter.trim().replace('@', ''),
          twitter: twitter.trim(),
          referralCode,
          spinsAvailable: 1,
        }], { session });

        if (!normalizedReferralCode) return;

        const reward = await User.findOneAndUpdate(
          {
            referralCode: normalizedReferralCode,
            $or: [
              { referralRewards: { $lt: REFERRAL_REWARD_LIMIT } },
              { referralRewards: { $exists: false } },
            ],
          },
          {
            $inc: {
              spinsAvailable: 1,
              tickets: 1,
              referrals: 1,
              referralRewards: 1,
            },
          },
          { new: true, session },
        );

        if (reward) {
          user.referredBy = reward.referralCode;
          await user.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json(serializeUser(user), { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
