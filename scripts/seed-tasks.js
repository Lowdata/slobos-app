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
    title: 'Follow @Slobos_ on X',
    description: 'Follow the official SLOBOS account on X',
    rewardSpins: 1,
    actionLink: followIntent('Slobos_')
  },
  {
    taskId: 'like_tweet',
    title: 'Like latest tweet',
    description: 'Like the most recent tweet from @Slobos_',
    rewardSpins: 1,
    actionLink: likeIntent('2076318920189870375')
  },
  {
    taskId: 'rt_tweet',
    title: 'Retweet latest tweet',
    description: 'Retweet the latest tweet to spread the word',
    rewardSpins: 1,
    actionLink: retweetIntent('2076318920189870375')
  },
  {
    taskId: 'share_referral',
    title: 'Share your referral link',
    description: 'Post your referral link on X to invite friends',
    rewardSpins: 1,
    actionLink: 'share_referral' // Special case to be handled by the frontend
  }
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing tasks and user progress
  await Task.deleteMany({});
  console.log('Cleared existing Tasks');
  
  const UserTask = mongoose.models.UserTask || mongoose.model('UserTask', new mongoose.Schema({
    walletAddress: { type: String, required: true },
    taskId: { type: String, required: true },
    completedAt: { type: Date, default: Date.now }
  }));
  await UserTask.deleteMany({});
  console.log('Cleared existing UserTasks');

  for (const task of TASKS) {
    await Task.create(task);
    console.log(`  ✓ ${task.taskId}`);
  }

  console.log(`\nSeeded ${TASKS.length} tasks.`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
