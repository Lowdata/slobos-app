import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { createRandomToken, hashValue, normalizeWalletAddress } from '@/lib/auth';
import { isRateLimited } from '@/lib/rate-limit';
import LoginNonce from '@/models/LoginNonce';

const NONCE_MAX_AGE_MS = 10 * 60 * 1000;

export async function POST(req) {
  try {
    if (isRateLimited(req, 'auth-nonce-ip', { limit: 20, windowMs: NONCE_MAX_AGE_MS })) {
      return NextResponse.json({ error: 'Too many login requests' }, { status: 429 });
    }
    const { walletAddress } = await req.json();
    const wallet = normalizeWalletAddress(walletAddress);
    if (!wallet) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    if (isRateLimited(req, 'auth-nonce-wallet', { limit: 5, windowMs: NONCE_MAX_AGE_MS, subject: wallet })) {
      return NextResponse.json({ error: 'Too many login requests' }, { status: 429 });
    }

    await connectToDatabase();
    const nonce = createRandomToken(32);
    const now = new Date();
    const origin = process.env.APP_URL || new URL(req.url).origin;
    const message = [
      'Sign in to SLOBOS',
      '',
      `Wallet: ${wallet}`,
      `Domain: ${origin}`,
      `Nonce: ${nonce}`,
      `Issued At: ${now.toISOString()}`,
    ].join('\n');

    await LoginNonce.create({
      walletAddress: wallet,
      nonceHash: hashValue(nonce),
      message,
      expiresAt: new Date(now.getTime() + NONCE_MAX_AGE_MS),
    });

    return NextResponse.json({ nonce, message });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
