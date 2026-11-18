import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer | undefined;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Make sure unique / TTL indexes exist before the first test runs.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );
}

export async function clearTestDb() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  );
}

export async function stopTestDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}
