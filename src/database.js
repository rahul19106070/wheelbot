import mongoose from 'mongoose';
import { config } from './config.js';

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  languageCode: String,
  referredBy: { type: Number, default: null },
  balance: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri, { family: 4 });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
  }
};
