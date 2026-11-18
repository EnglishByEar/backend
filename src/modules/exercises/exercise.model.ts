import mongoose, { Schema, Document, Model } from "mongoose";

export const EXERCISE_DIFFICULTIES = ["Simple", "Medium", "Advanced"] as const;
export const EXERCISE_CATEGORIES = [
  "Elementary",
  "Intermediate",
  "Advanced",
] as const;

export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export interface IExercise extends Document {
  slug: string;
  title: string;
  description?: string;
  difficulty: ExerciseDifficulty;
  category: ExerciseCategory;
  /** The transcript the learner must type. Never sent before submission. */
  text: string;
  audioUrl?: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const exerciseSchema = new Schema<IExercise>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    difficulty: {
      type: String,
      enum: EXERCISE_DIFFICULTIES,
      required: true,
    },

    category: {
      type: String,
      enum: EXERCISE_CATEGORIES,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    audioUrl: {
      type: String,
      trim: true,
    },

    published: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

exerciseSchema.index({ published: 1, difficulty: 1, category: 1 });

export const Exercise: Model<IExercise> =
  mongoose.models.Exercise ||
  mongoose.model<IExercise>("Exercise", exerciseSchema);
