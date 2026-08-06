import dotenv from 'dotenv';
dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN,
  mongoUri: process.env.MONGODB_URI,
  forceSubChannels: process.env.FORCE_SUB_CHANNELS ? process.env.FORCE_SUB_CHANNELS.split(',') : [],
  joinAllLink: process.env.JOIN_ALL_LINK || '',
  webAppUrl: process.env.WEB_APP_URL || 'https://example.com',
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(Number) : [7336787354, 6512279895]
};

if (!config.botToken) {
  console.error("FATAL ERROR: BOT_TOKEN must be defined in .env");
  process.exit(1);
}
if (!config.mongoUri) {
  console.error("FATAL ERROR: MONGODB_URI must be defined in .env");
  process.exit(1);
}
