import { NextResponse } from 'next/server';
import { verifyMessage } from 'ethers';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import {
  createRandomToken,
  hashValue,
  normalizeWalletAddress,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/auth';
import { isRateLimited } from '@/lib/rate-limit';
import LoginNonce from '@/models/LoginNonce';
import Session from '@/models/Session';

export async function POST(req) {
  try {
    if (isRateLimited(req, 'auth-verify-ip', { limit: 30, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json({ error: 'Too many login attempts' }, { status: 429 });
    }
    const { walletAddress, nonce, signature } = await req.json();
    const wallet = normalizeWalletAddress(walletAddress);
    if (!wallet || typeof nonce !== 'string' || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Invalid login request' }, { status: 400 });
    }
    if (isRateLimited(req, 'auth-verify-wallet', { limit: 10, windowMs: 10 * 60 * 1000, subject: wallet })) {
      return NextResponse.json({ error: 'Too many login attempts' }, { status: 429 });
    }

    await connectToDatabase();
    const now = new Date();
    const loginNonce = await LoginNonce.findOneAndUpdate(
      {
        walletAddress: wallet,
        nonceHash: hashValue(nonce),
        usedAt: null,
        expiresAt: mongoose.trusted({ $gt: now }),
      },
      { $set: { usedAt: now } },
      { new: true },
    ).lean();

    if (!loginNonce) {
      return NextResponse.json({ error: 'Login request expired or already used' }, { status: 401 });
    }

    let signer;
    try {
      signer = normalizeWalletAddress(verifyMessage(loginNonce.message, signature));
    } catch {
      signer = null;
    }
    if (signer !== wallet) {
      return NextResponse.json({ error: 'Signature does not match wallet' }, { status: 401 });
    }

    const token = createRandomToken(32);
    await Session.create({
      walletAddress: wallet,
      tokenHash: hashValue(token),
      expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid login request' }, { status: 400 });
  }
}
