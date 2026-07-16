import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import Task from '@/models/Task';
import UserTask from '@/models/UserTask';
import User from '@/models/User';
import { requireUser } from '@/lib/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { findUserByWallet, serializeUser } from '@/lib/users';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    if (isRateLimited(req, 'tasks-read', { limit: 60, windowMs: 60 * 1000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    await connectToDatabase();
    const walletAddress = await requireUser(req);

    // Return all tasks
    const tasks = await Task.find({});
    
    // Completion status is derived from the authenticated session rather than
    // a wallet address supplied in the query string.
    let completed = [];
    if (walletAddress) {
      const userTasks = await UserTask.find({ walletAddress });
      completed = userTasks.map(ut => ut.taskId);
    }

    return NextResponse.json({ tasks, completed });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (isRateLimited(req, 'task-claim-ip', { limit: 30, windowMs: 60 * 1000 })) {
      return NextResponse.json({ error: 'Too many task requests' }, { status: 429 });
    }
    const walletAddress = await requireUser(req);
    if (!walletAddress) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (isRateLimited(req, 'task-claim-wallet', { limit: 10, windowMs: 60 * 1000, subject: walletAddress })) {
      return NextResponse.json({ error: 'Too many task requests' }, { status: 429 });
    }

    await connectToDatabase();
    const body = await req.json();
    const { taskId } = body;

    if (typeof taskId !== 'string' || taskId.length === 0 || taskId.length > 100 || taskId.trim() !== taskId) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    const session = await mongoose.startSession();
    let task;
    let user;
    let outcome;
    try {
      await session.withTransaction(async () => {
        task = await Task.findOne({ taskId }).session(session);
        if (!task) {
          outcome = 'task-not-found';
          return;
        }

        const existingUser = await findUserByWallet(walletAddress, session);
        if (!existingUser) {
          outcome = 'user-not-found';
          return;
        }

        // The unique index rejects duplicate claims; the transaction makes the
        // completion record and atomic reward increment succeed or fail together.
        await UserTask.create([{ walletAddress, taskId }], { session });
        user = await User.findByIdAndUpdate(
          existingUser._id,
          { $inc: { spinsAvailable: task.rewardSpins } },
          { new: true, session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (outcome) {
      return NextResponse.json(
        { error: outcome === 'task-not-found' ? 'Task not found' : 'User not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, rewardSpins: task.rewardSpins, user: serializeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Task already completed' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
