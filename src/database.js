import mongoose from 'mongoose';
import { config } from './config.js';

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  languageCode: String,
  referredBy: { type: Number, default: null },
  referralRewardClaimed: { type: Boolean, default: false },
  referralsCount: { type: Number, default: 0 },
  referredUsers: [{ type: Number }],
  balance: { type: Number, default: 0 },
  spinsLeft: { type: Number, default: 1 }, // Default 1 spin
  lastSpinDate: { type: String, default: '' },
  upiId: { type: String, default: null },
  joinedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);

const withdrawalSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  upiId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now }
});

export const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri, { family: 4 });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
  }
};
