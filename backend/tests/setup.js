import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterAll, afterEach } from 'vitest';
// Importing the app registers every Mongoose model and loads config in test mode.
import '../src/app.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('syt_test'));
  // Build unique + 2dsphere/text indexes so constraint and geo queries behave
  // exactly as they would against a real MongoDB.
  await Promise.all(
    Object.values(mongoose.connection.models).map((model) => model.createIndexes())
  );
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});
