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

// Pre-made tweet messages using Twitter intent API
const tweetIntent = (text) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

const followIntent = (username) =>
  `https://twitter.com/intent/follow?screen_name=${username}`;

const retweetIntent = (tweetId) =>
  `https://twitter.com/intent/retweet?tweet_id=${tweetId}`;

const likeIntent = (tweetId) =>
  `https://twitter.com/intent/like?tweet_id=${tweetId}`;

const TASKS = [
  {
    taskId: 'follow_twitter',
    title: 'Follow @SLOBOS on X',
    description: 'Follow the official SLOBOS account on X',
    rewardSpins: 3,
    actionLink: followIntent('SLOBOS')
  },
  {
    taskId: 'rt_pinned',
    title: 'Like and RT pinned tweet',
    description: 'Like and RT the pinned launch tweet to spread the word',
    rewardSpins: 2,
    actionLink: 'https://twitter.com/SLOBOS' // Replace with actual tweet URL when pinned tweet is live
  },
  {
    taskId: 'like_tweet',
    title: 'Like latest tweet',
    description: 'Like the most recent tweet from @SLOBOS',
    rewardSpins: 1,
    actionLink: 'https://twitter.com/SLOBOS' // Replace with actual tweet URL
  },
  {
    taskId: 'invite_friend',
    title: 'Invite a friend',
    description: 'Share your referral link and get a friend to sign up',
    rewardSpins: 2,
    actionLink: null // handled by the referral system
  },
  {
    taskId: 'tweet_referral',
    title: 'Share your referral link',
    description: 'Tweet your personal referral link to earn bonus spins',
    rewardSpins: 2,
    actionLink: tweetIntent(
      `Spinning the @SLOBOS wheel for a GTD whitelist spot 🎰\n\nEvery spin = a chance at a WL or raffle tickets. Free to play, zero catch.\n\nUse my link to get started 👇`
    )
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
