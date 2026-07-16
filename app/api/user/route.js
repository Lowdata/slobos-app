import connectToDatabase from '@/lib/mongodb';
import { requireUser } from '@/lib/auth';
import { findUserByWallet, serializeUser } from '@/lib/users';
import User from '@/models/User';
import { NextResponse } from 'next/server';

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
    if (typeof twitter !== 'string' || !twitter.trim()) {
      return NextResponse.json({ error: 'A Twitter handle is required' }, { status: 400 });
    }
    if (referredBy !== undefined && typeof referredBy !== 'string') {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    await connectToDatabase();
    let user = await findUserByWallet(walletAddress);
    if (user) {
      return NextResponse.json(serializeUser(user));
    }

    const username = twitter.trim().replace('@', '');
    const generateRefCode = (name) => {
      const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return (prefix + random).slice(0, 7);
    };

    let refBy = null;
    if (referredBy?.trim()) {
      const referrer = await User.findOne({ referralCode: referredBy.trim() });
      if (referrer) {
        refBy = referrer.referralCode;
        referrer.spinsAvailable += 1;
        referrer.tickets += 1;
        referrer.referrals += 1;
        await referrer.save();
      }
    }

    let referralCode = generateRefCode(username);
    while (await User.findOne({ referralCode })) {
      referralCode = generateRefCode(username);
    }

    user = await User.create({
      walletAddress,
      username,
      twitter: twitter.trim(),
      referralCode,
      referredBy: refBy,
      spinsAvailable: 1,
    });

    return NextResponse.json(serializeUser(user), { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
