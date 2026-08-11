console.log("Starting WheelEarnBot... Deploy Test!");
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

// Prevent Telegram unhandled rejections from crashing the bot
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});


import { Telegraf } from 'telegraf';
import express from 'express';
import cors from 'cors';
import { config } from './src/config.js';
import { connectDB, User } from './src/database.js';
import { setupHandlers } from './src/handlers.js';

const app = express();
app.use(cors());
app.use(express.json());

// API: Get user data (handles daily spin reset)
app.get('/api/user', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing ID' });
  
  try {
    const user = await User.findOne({ telegramId: Number(id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Check daily reset
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = istTime.toISOString().split('T')[0];
    
    if (user.lastSpinDate !== todayIST) {
      user.spinsLeft = Math.max(1, user.spinsLeft); // Give 1 daily spin if they have none, otherwise keep their stacked spins
      user.lastSpinDate = todayIST;
      await user.save();
    }
    
    res.json({
      balance: user.balance,
      spinsLeft: user.spinsLeft,
      upiId: user.upiId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Process spin
app.post('/api/spin', async (req, res) => {
  const { id, winAmount, prizeType } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing data' });
  
  try {
    const user = await User.findOne({ telegramId: Number(id) });
    if (!user || user.spinsLeft <= 0) return res.status(400).json({ error: 'No spins left' });
    
    user.spinsLeft -= 1;
    if (prizeType === 'spin') {
       user.spinsLeft += 1;
    } else {
       user.balance += Number(winAmount || 0);
    }
    await user.save();
    
    res.json({ success: true, balance: user.balance, spinsLeft: user.spinsLeft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Save UPI
app.post('/api/upi', async (req, res) => {
  const { id, upiId } = req.body;
  if (!id || !upiId) return res.status(400).json({ error: 'Missing data' });
  
  try {
    const user = await User.findOneAndUpdate({ telegramId: Number(id) }, { upiId }, { new: true });
    res.json({ success: true, upiId: user.upiId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const startBot = async () => {
  connectDB(); // Run in background
  
  const bot = new Telegraf(config.botToken);
  setupHandlers(bot);

  bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
  });

  bot.launch()
    .then(async () => {
      console.log('✅ Wheel Earn Bot is successfully running!');
      
      // Set global commands
      await bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'setupi', description: 'Set your UPI ID' }
      ]).catch(e => console.error('Failed to set global commands:', e.message));
      
      // Set admin commands
      for (const adminId of config.adminIds) {
        try {
          await bot.telegram.setMyCommands([
            { command: 'start', description: 'Start the bot' },
            { command: 'setupi', description: 'Set your UPI ID' },
            { command: 'admin', description: 'Open Admin Portal' },
            { command: 'cancel', description: 'Cancel current action' }
          ], { scope: { type: 'chat', chat_id: adminId } });
        } catch (e) {
          console.error(`Failed to set commands for admin ${adminId}:`, e.message);
        }
      }
    })
    .catch((err) => {
      console.error('Failed to launch bot:', err);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
  // Start Express API
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ API Server running on port ${PORT}`);
  });
};

startBot();
