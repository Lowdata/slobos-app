// Seed script — run once: node scripts/seed-tasks.js
// Adds the initial set of tasks to MongoDB.

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/slobos';

const TaskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  rewardSpins: { type: Number, required: true },
  actionLink: { type: String }
});

const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

const TASKS = [
  {
    taskId: 'follow_twitter',
    title: 'Follow @SLOBOS on X',
    description: 'Follow the official SLOBOS account on X (Twitter)',
    rewardSpins: 3,
    actionLink: 'https://twitter.com/SLOBOS'
  },
  {
    taskId: 'rt_pinned',
    title: 'Retweet pinned launch tweet',
    description: 'RT the pinned tweet to spread the word',
    rewardSpins: 2,
    actionLink: 'https://twitter.com/SLOBOS'
  },
  {
    taskId: 'join_discord',
    title: 'Join Discord server',
    description: 'Join the SLOBOS Discord community',
    rewardSpins: 2,
    actionLink: 'https://discord.gg/slobos'
  },
  {
    taskId: 'like_tweet',
    title: 'Like latest tweet',
    description: 'Like the most recent tweet from @SLOBOS',
    rewardSpins: 1,
    actionLink: 'https://twitter.com/SLOBOS'
  },
  {
    taskId: 'quote_tweet',
    title: 'Quote tweet about SLOBOS',
    description: 'Quote tweet about your experience with the roulette',
    rewardSpins: 3,
    actionLink: 'https://twitter.com/SLOBOS'
  },
  {
    taskId: 'invite_friend',
    title: 'Invite 1 friend',
    description: 'Share your referral link and get a friend to spin',
    rewardSpins: 2,
    actionLink: null
  }
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const task of TASKS) {
    await Task.findOneAndUpdate(
      { taskId: task.taskId },
      task,
      { upsert: true, new: true }
    );
    console.log(`  ✓ ${task.taskId}`);
  }

  console.log(`\nSeeded ${TASKS.length} tasks.`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
