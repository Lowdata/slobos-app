import crypto from 'crypto';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import { requireUser } from '@/lib/auth';
import { findUserByWallet, serializeUser } from '@/lib/users';
import { NextResponse } from 'next/server';

const CONFIG = {
  ODDS: { red: 6900, black: 3000, green: 100 },
  GREEN_DOWNGRADE_TICKETS: 3,
};

function rollColor() {
  const roll = crypto.randomInt(10_000);
  if (roll < CONFIG.ODDS.red) return 'red';
  if (roll < CONFIG.ODDS.red + CONFIG.ODDS.black) return 'black';
  return 'green';
}

export async function POST(req) {
  try {
    const walletAddress = await requireUser(req);
    if (!walletAddress) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await connectToDatabase();
    const session = await mongoose.startSession();
    let result;
    let ticketsWon = 0;
    let user;
    let error = null;

    try {
      await session.withTransaction(async () => {
        user = await findUserByWallet(walletAddress, session);
        if (!user) {
          error = 'User not found';
          return;
        }
        if (user.spinsAvailable <= 0) {
          error = 'Out of spins';
          return;
        }

        user.spinsAvailable -= 1;
        ticketsWon = 0;
        result = rollColor();

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

        await user.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (error) {
      return NextResponse.json({ error }, { status: error === 'User not found' ? 404 : 400 });
    }
    return NextResponse.json({ result, user: serializeUser(user), ticketsWon });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
