import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { Telegraf } from 'telegraf';
import { config } from './src/config.js';
import { connectDB } from './src/database.js';
import { setupHandlers } from './src/handlers.js';

const startBot = async () => {
  connectDB(); // Run in background
  
  const bot = new Telegraf(config.botToken);
  
  setupHandlers(bot);

  bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
  });

  bot.launch()
    .then(() => {
      console.log('✅ Wheel Earn Bot is successfully running!');
    })
    .catch((err) => {
      console.error('Failed to launch bot:', err);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

startBot();
