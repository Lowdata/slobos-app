import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { walletAddress, username, referredBy } = body;

    if (!walletAddress || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let user = await User.findOne({ walletAddress });
    
    // Referral code generation (up to 7 chars)
    const generateRefCode = (name) => {
      const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return (prefix + random).slice(0, 7);
    };

    if (!user) {
      // Check if referrer exists and give them a spin (simulated backend credit)
      let refBy = null;
      if (referredBy) {
        const referrer = await User.findOne({ referralCode: referredBy });
        if (referrer) {
           refBy = referrer.referralCode;
           referrer.spinsAvailable += 1;
           referrer.tickets += 1;
           referrer.referrals += 1;
           await referrer.save();
        }
      }

      let referralCode = generateRefCode(username);
      // Ensure unique referral code
      while (await User.findOne({ referralCode })) {
        referralCode = generateRefCode(username);
      }

      user = await User.create({
        walletAddress,
        username,
        referralCode,
        referredBy: refBy,
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("User API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
