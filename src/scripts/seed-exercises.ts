import { readFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDatabase } from "../config/database.js";
import {
  Exercise,
  EXERCISE_CATEGORIES,
  EXERCISE_DIFFICULTIES,
} from "../modules/exercises/exercise.model.js";

// Run from the project root:  pnpm seed:exercises
// Safe to run repeatedly: exercises are upserted by slug.

const seedItemSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  difficulty: z.enum(EXERCISE_DIFFICULTIES),
  category: z.enum(EXERCISE_CATEGORIES),
  text: z.string().min(1),
  // Path of the audio file in the OLD storage bucket. It is informational:
  // upload the file to your new storage and set `audioUrl` on the exercise.
  audioPath: z.string().nullable().optional(),
  published: z.boolean(),
});

async function main() {
  const file = path.resolve(process.cwd(), "seed/exercises.json");
  const items = z
    .array(seedItemSchema)
    .parse(JSON.parse(await readFile(file, "utf8")));

  await connectDatabase();

  const result = await Exercise.bulkWrite(
    items.map(({ audioPath: _audioPath, description, ...exercise }) => ({
      updateOne: {
        filter: { slug: exercise.slug },
        update: {
          $set: { ...exercise, ...(description ? { description } : {}) },
        },
        upsert: true,
      },
    }))
  );

  console.log(
    `Exercises seeded: ${result.upsertedCount} created, ${result.modifiedCount} updated, ${items.length} total`
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seeding failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});