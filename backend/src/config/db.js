import mongoose from 'mongoose';
import { config } from './index.js';

mongoose.set('strictQuery', true);

export async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri, {
      autoIndex: config.env !== 'production',
    });
    console.log(`[db] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
