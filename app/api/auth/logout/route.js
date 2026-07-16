import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { hashValue, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import Session from '@/models/Session';

export async function POST(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectToDatabase();
    await Session.deleteOne({ tokenHash: hashValue(token) });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
