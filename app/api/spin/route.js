import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { NextResponse } from 'next/server';

const CONFIG = {
  ODDS: { red: 0.54, black: 0.45, green: 0.01 },
  GREEN_DOWNGRADE_TICKETS: 3,
};

function rollColor() {
  const r = Math.random();
  if (r < CONFIG.ODDS.red) return 'red';
  if (r < CONFIG.ODDS.red + CONFIG.ODDS.black) return 'black';
  return 'green';
}

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.spinsAvailable <= 0) {
      return NextResponse.json({ error: 'Out of spins' }, { status: 400 });
    }

    user.spinsAvailable -= 1;
    
    const result = rollColor();
    let ticketsWon = 0;
    
    if (result === 'black') {
      user.tickets += 1;
      ticketsWon = 1;
    } else if (result === 'green') {
      if (!user.wonWL) {
        user.wonWL = true;
      } else {
        user.tickets += CONFIG.GREEN_DOWNGRADE_TICKETS;
        ticketsWon = CONFIG.GREEN_DOWNGRADE_TICKETS;
      }
    }

    await user.save();

    return NextResponse.json({ result, user, ticketsWon });
  } catch (error) {
    console.error("Spin API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
