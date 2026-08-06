import { config } from './config.js';
import { User, Withdrawal } from './database.js';

const broadcastState = new Map();

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

const sendWelcomeMessage = async (ctx, user) => {
  if (user && user.referredBy && !user.referralRewardClaimed) {
      try {
        const inviter = await User.findOneAndUpdate(
           { telegramId: user.referredBy }, 
           { 
             $inc: { balance: 5, referralsCount: 1 },
             $push: { referredUsers: ctx.from.id }
           }, 
           { new: true }
        );
        if (inviter) {
           ctx.telegram.sendMessage(user.referredBy, `🎉 <b>Good news!</b> Someone just joined using your referral link!\n\nYou have been rewarded with Rs.5 Upi Cash! 💰`, { parse_mode: 'HTML' }).catch(e => console.error(e));
        }
        user.referralRewardClaimed = true;
        await user.save();
      } catch (e) {
        console.error("Referral reward error", e);
      }
  }

  const welcomeMsg = `🎡 Welcome to the Earning Bot!\n\n💰 Earn real cash by:\n• 👥 Referring friends — Rs.5 Upi Cash each\n• 📢 Joining channels\n\n🏦 Withdraw directly to your UPI!\nTap below to start earning 👇`;
  
  return ctx.reply(welcomeMsg, { 
    disable_web_page_preview: true,
    reply_markup: {
      keyboard: [
        [{ text: '💰 Balance' }, { text: '👥 Refer Earn' }],
        [{ text: '🎉 Bonus' }, { text: '💸 Withdraw' }],
        [{ text: '🏦 Payout Method' }, { text: '💐 Earn More' }]
      ],
      resize_keyboard: true,
      persistent: true
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

    await sendWelcomeMessage(ctx, user);
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
    
    const user = await User.findOne({ telegramId: ctx.from.id });
    await sendWelcomeMessage(ctx, user);
  });

  // Reply Keyboard Handlers
  bot.hears('💰 Balance', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Error: User not found.');
    ctx.reply(`💰 <b>Your Balance:</b> Rs.${user.balance.toFixed(2)}\n\nTo earn more, invite your friends!`, { parse_mode: 'HTML' });
  });

  bot.hears('👥 Refer Earn', async (ctx) => {
    const botInfo = await ctx.telegram.getMe();
    const refLink = `https://t.me/${botInfo.username}?start=ref_${ctx.from.id}`;
    
    const msg = `💰 <b>Per Refer Rs.5 Upi Cash</b>\n\n👤 <b>Your Referral Link:</b>\n${refLink}\n\nShare With Your Friends & Family And Earn Refer Bonus Easily ✨🤑`;
    
    ctx.reply(msg, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 My Invites', callback_data: 'my_invites' }, { text: '🏆 Leaderboard', callback_data: 'leaderboard' }],
          [{ text: '👥 Refer Tracker', callback_data: 'refer_tracker' }]
        ]
      }
    });
  });

  bot.action('my_invites', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    ctx.answerCbQuery();
    ctx.reply(`📊 <b>Your Invites Statistics</b>\n\n👥 Total Invites: ${user.referralsCount}\n💰 Earned from Invites: Rs.${(user.referralsCount * 5).toFixed(2)}`, { parse_mode: 'HTML' });
  });
  
  bot.action('leaderboard', (ctx) => {
    ctx.answerCbQuery('🏆 Leaderboard coming soon!', { show_alert: true });
  });
  
  bot.action('refer_tracker', (ctx) => {
    ctx.answerCbQuery('👥 Refer tracker coming soon!', { show_alert: true });
  });

  bot.hears('🎉 Bonus', (ctx) => {
    ctx.reply('🎉 Daily bonus is currently disabled. Keep referring to earn!');
  });

  bot.hears('💸 Withdraw', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user.balance < 20) {
      return ctx.reply(`❌ <b>Minimum withdrawal is Rs.20.</b>\nYour current balance is Rs.${user.balance.toFixed(2)}.`, { parse_mode: 'HTML' });
    }
    if (!user.upiId) {
      return ctx.reply(`⚠️ You haven't set your payout method yet! Please click <b>🏦 Payout Method</b> to set it up.`, { parse_mode: 'HTML' });
    }
    
    // Create withdrawal request
    const amount = user.balance;
    const w = new Withdrawal({
      telegramId: user.telegramId,
      upiId: user.upiId,
      amount: amount
    });
    await w.save();
    
    // Reset user balance
    user.balance = 0;
    await user.save();
    
    ctx.reply(`✅ Withdrawal request for Rs.${amount.toFixed(2)} has been recorded to ${user.upiId}. Pending admin approval.`);
  });

  bot.hears('🏦 Payout Method', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    const currentMethod = user.upiId ? `\n\nCurrent UPI: <code>${user.upiId}</code>` : '';
    ctx.reply(`🏦 To set your UPI ID, use the command:\n<code>/setupi your_upi_id@ybl</code>${currentMethod}`, { parse_mode: 'HTML' });
  });

  bot.command('setupi', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('⚠️ Usage: /setupi your_upi_id');
    const newUpi = args[1];
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { upiId: newUpi });
    ctx.reply(`✅ Your UPI ID has been set to: <b>${newUpi}</b>`, { parse_mode: 'HTML' });
  });

  bot.hears('💐 Earn More', (ctx) => {
    ctx.reply('💐 Stay tuned! More earning tasks are coming soon.');
  });

  // Admin Command
  bot.command('admin', async (ctx) => {
    if (!config.adminIds.includes(ctx.from.id)) {
      return ctx.reply('❌ You do not have permission to use this command.');
    }
    
    const totalUsers = await User.countDocuments();
    
    // Calculate total referrals
    const referralStats = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$referralsCount' } } }
    ]);
    const totalReferrals = referralStats.length > 0 ? referralStats[0].total : 0;
    
    const msg = `👑 <b>Admin Portal</b>\n\n👥 Total Users: ${totalUsers}\n🔗 Total Referrals Made: ${totalReferrals}\n\nSelect an action below:`;
    ctx.reply(msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Broadcast Message', callback_data: 'admin_broadcast' }],
          [{ text: '🛑 Stop Broadcast', callback_data: 'admin_stop_broadcast' }],
          [{ text: '💸 Manage Withdrawals', callback_data: 'admin_withdrawals' }]
        ]
      }
    });
  });
  
  bot.action('admin_broadcast', (ctx) => {
    broadcastState.set(ctx.from.id, true);
    ctx.answerCbQuery();
    ctx.reply('📢 Please send the message you want to broadcast. Or type /cancel to stop.');
  });
  
  bot.action('admin_stop_broadcast', (ctx) => {
    broadcastState.delete(ctx.from.id);
    ctx.answerCbQuery('🛑 Broadcast cancelled.');
    ctx.reply('Broadcast cancelled.');
  });
  
  bot.command('cancel', (ctx) => {
    if (broadcastState.has(ctx.from.id)) {
      broadcastState.delete(ctx.from.id);
      ctx.reply('🛑 Broadcast cancelled.');
    }
  });

  bot.action('admin_withdrawals', async (ctx) => {
    const pending = await Withdrawal.find({ status: 'pending' }).limit(5);
    if (pending.length === 0) {
      return ctx.answerCbQuery('No pending withdrawals.', { show_alert: true });
    }
    
    ctx.answerCbQuery();
    for (const w of pending) {
       const msg = `💸 <b>Pending Withdrawal</b>\n\nUser: <code>${w.telegramId}</code>\nAmount: Rs.${w.amount.toFixed(2)}\nUPI: <code>${w.upiId}</code>`;
       ctx.reply(msg, {
         parse_mode: 'HTML',
         reply_markup: {
           inline_keyboard: [
             [{ text: '✅ Mark Paid', callback_data: `paid_${w._id}` }],
             [{ text: '❌ Reject (Refund)', callback_data: `reject_${w._id}` }]
           ]
         }
       });
    }
  });

  bot.action(/^paid_(.+)$/, async (ctx) => {
    const wId = ctx.match[1];
    const w = await Withdrawal.findByIdAndUpdate(wId, { status: 'paid' });
    if (w) {
       ctx.answerCbQuery('Marked as paid!');
       ctx.editMessageText(`✅ Withdrawal ${wId} marked as PAID.`);
       try {
         await ctx.telegram.sendMessage(w.telegramId, `✅ <b>Withdrawal Processed!</b>\n\nYour withdrawal of Rs.${w.amount.toFixed(2)} to ${w.upiId} has been paid!`, { parse_mode: 'HTML' });
       } catch(e) {}
    }
  });

  bot.action(/^reject_(.+)$/, async (ctx) => {
    const wId = ctx.match[1];
    const w = await Withdrawal.findByIdAndUpdate(wId, { status: 'rejected' });
    if (w) {
       await User.findOneAndUpdate({ telegramId: w.telegramId }, { $inc: { balance: w.amount } });
       ctx.answerCbQuery('Rejected and refunded!');
       ctx.editMessageText(`❌ Withdrawal ${wId} rejected. Balance refunded.`);
       try {
         await ctx.telegram.sendMessage(w.telegramId, `❌ <b>Withdrawal Rejected!</b>\n\nYour withdrawal of Rs.${w.amount.toFixed(2)} to ${w.upiId} was rejected. The amount has been refunded to your balance.`, { parse_mode: 'HTML' });
       } catch(e) {}
    }
  });

  bot.on('message', async (ctx, next) => {
    if (broadcastState.has(ctx.from.id) && ctx.message.text && !ctx.message.text.startsWith('/')) {
      broadcastState.delete(ctx.from.id);
      const textToBroadcast = ctx.message.text;
      ctx.reply('📢 Broadcasting message to all users... this may take a moment.');
      
      const users = await User.find({}, 'telegramId');
      let success = 0;
      let failed = 0;
      for (const u of users) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, textToBroadcast);
          success++;
        } catch (e) {
          failed++;
        }
      }
      return ctx.reply(`✅ Broadcast complete!\n\nSent: ${success}\nFailed: ${failed}`);
    }
    
    const chat = ctx.message.forward_from_chat || (ctx.message.forward_origin && ctx.message.forward_origin.chat);
    if (chat) {
       return ctx.reply(`✅ *Chat ID Found!*\n\nChannel: ${chat.title}\nID: \`${chat.id}\`\n\nPlease copy this ID and send it here!`, { parse_mode: 'Markdown' });
    }
    
    return next();
  });

  bot.on('channel_post', (ctx) => {
    if (ctx.channelPost && ctx.channelPost.chat) {
       console.log(`\n\n🎯 CHANNEL DETECTED: "${ctx.channelPost.chat.title}"`);
       console.log(`🎯 CHAT ID: ${ctx.channelPost.chat.id}\n\n`);
    }
  });
};
