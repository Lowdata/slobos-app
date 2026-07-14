import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

// GET — check if wallet exists, or if username is taken
export async function GET(req) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');
    const checkUsername = searchParams.get('checkUsername');

    // Check if a wallet already has an account
    if (wallet) {
      const user = await User.findOne({ walletAddress: wallet });
      if (user) {
        return NextResponse.json({ exists: true, user });
      }
      return NextResponse.json({ exists: false });
    }

    // Check if a username is already taken
    if (checkUsername) {
      const taken = await User.findOne({ username: checkUsername });
      return NextResponse.json({ taken: !!taken });
    }

    return NextResponse.json({ error: 'No query provided' }, { status: 400 });
  } catch (error) {
    console.error("User GET Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST — create new user
export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { walletAddress, username, twitter, referredBy } = body;

    if (!walletAddress || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Return existing user if wallet is already registered
    let user = await User.findOne({ walletAddress });
    if (user) {
      return NextResponse.json(user);
    }

    // Block duplicate usernames
    const usernameTaken = await User.findOne({ username });
    if (usernameTaken) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Referral code generation (up to 7 chars)
    const generateRefCode = (name) => {
      const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return (prefix + random).slice(0, 7);
    };

    // Credit referrer
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
    while (await User.findOne({ referralCode })) {
      referralCode = generateRefCode(username);
    }

    user = await User.create({
      walletAddress,
      username,
      twitter: twitter || null,
      referralCode,
      referredBy: refBy,
      spinsAvailable: 0,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("User POST Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
