import { config } from './config.js';
import { User } from './database.js';

export const checkChannelsMembership = async (ctx, channels) => {
  if (!channels || channels.length === 0) return true;
  for (const channelStr of channels) {
    if (!channelStr) continue;
    const chatId = channelStr.includes('|') ? channelStr.split('|')[0] : channelStr;
    try {
      const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
      if (member.status === 'left' || member.status === 'kicked') {
        return false;
      }
    } catch (error) {
      console.error(`Error checking membership for ${chatId}:`, error.message);
      return false; 
    }
  }
  return true;
};

const sendWelcomeMessage = async (ctx) => {
  const welcomeMsg = `🎡 Welcome to Wheel Earn!\n\n💰 Earn real USDT by:\n• 🎬 Watching ads — spin the wheel & win!\n• 👥 Referring friends — $1 each\n• 📢 Joining channels — $1 each\n\n🏦 Withdraw in USDT (TRC20/ERC20/BEP20) \nTap below to start earning 👇`;
  
  return ctx.reply(welcomeMsg, { 
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: '🎡 Open Wheel Earn', web_app: { url: config.webAppUrl } }]]
    }
  });
};

const handleForcesubAndPayload = async (ctx, user, payload) => {
    if (config.forceSubChannels && config.forceSubChannels.length > 0) {
        const isMember = await checkChannelsMembership(ctx, config.forceSubChannels);
        if (!isMember) {
            const inline_keyboard = [];
            
            config.forceSubChannels.forEach((channelStr, index) => {
                if (channelStr) {
                    let url = `https://t.me/${channelStr.replace('@', '')}`;
                    if (channelStr.includes('|')) {
                        url = channelStr.split('|')[1];
                    } else if (channelStr.startsWith('http')) {
                        url = channelStr;
                    }
                    inline_keyboard.push([{ text: `📢 Join Channel ${index + 1}`, url: url }]);
                }
            });
            
            if (config.joinAllLink) {
                inline_keyboard.push([{ text: '🔗 Join All Channels', url: config.joinAllLink }]);
            }
            
            const cbData = payload ? `chksub_${payload}` : 'chksub_';
            inline_keyboard.push([{ text: '✅ I have joined', callback_data: cbData }]);

            const welcomeMsg = `⚠️ <b>Access Denied!</b>\n\nYou must join all our channels below to use this bot! 👇`;

            return ctx.reply(welcomeMsg, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: inline_keyboard
                }
            });
        }
    }

    await sendWelcomeMessage(ctx);
};

export const setupHandlers = (bot) => {
  bot.command('start', async (ctx) => {
    const payload = ctx.payload;
    
    let user;
    try {
      user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        user = new User({
          telegramId: ctx.from.id,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          languageCode: ctx.from.language_code
        });
        
        if (payload && payload.startsWith('ref_')) {
          const inviterId = parseInt(payload.split('_')[1]);
          if (!isNaN(inviterId) && inviterId !== ctx.from.id) {
             user.referredBy = inviterId;
          }
        }
        await user.save();
      }
    } catch (err) {
      console.error("Error saving user:", err);
    }

    await handleForcesubAndPayload(ctx, user, payload);
  });

  bot.action(/^chksub_(.*)$/, async (ctx) => {
    const payload = ctx.match[1];
    
    const isMember = await checkChannelsMembership(ctx, config.forceSubChannels);
    if (!isMember) {
        return ctx.answerCbQuery('❌ You have not joined all channels yet!', { show_alert: true });
    }
    
    await ctx.answerCbQuery('✅ Verification successful!');
    
    try {
        await ctx.deleteMessage();
    } catch(e) { }
    
    await sendWelcomeMessage(ctx);
  });

  bot.on('message', async (ctx) => {
    const chat = ctx.message.forward_from_chat || (ctx.message.forward_origin && ctx.message.forward_origin.chat);
    if (chat) {
       return ctx.reply(`✅ *Chat ID Found!*\n\nChannel: ${chat.title}\nID: \`${chat.id}\`\n\nPlease copy this ID and send it here!`, { parse_mode: 'Markdown' });
    }
  });

  bot.on('channel_post', (ctx) => {
    if (ctx.channelPost && ctx.channelPost.chat) {
       console.log(`\n\n🎯 CHANNEL DETECTED: "${ctx.channelPost.chat.title}"`);
       console.log(`🎯 CHAT ID: ${ctx.channelPost.chat.id}\n\n`);
    }
  });
};
