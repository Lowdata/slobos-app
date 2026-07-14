import connectToDatabase from '@/lib/mongodb';
import Task from '@/models/Task';
import UserTask from '@/models/UserTask';
import User from '@/models/User';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    await connectToDatabase();
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('wallet');

    // Return all tasks
    const tasks = await Task.find({});
    
    // If wallet provided, return completed tasks too
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
    await connectToDatabase();
    const body = await req.json();
    const { walletAddress, taskId } = body;

    if (!walletAddress || !taskId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const task = await Task.findOne({ taskId });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const existing = await UserTask.findOne({ walletAddress, taskId });
    if (existing) {
      return NextResponse.json({ error: 'Task already completed' }, { status: 400 });
    }

    // Complete task
    await UserTask.create({ walletAddress, taskId });
    
    // Reward user
    const user = await User.findOne({ walletAddress });
    if (user) {
      user.spinsAvailable += task.rewardSpins;
      await user.save();
    }

    return NextResponse.json({ success: true, rewardSpins: task.rewardSpins, user });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
