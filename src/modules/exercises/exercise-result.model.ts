import mongoose, { Schema, Document, Model } from "mongoose";

export interface IExerciseResult extends Document {
  userId: mongoose.Types.ObjectId;
  exerciseId: mongoose.Types.ObjectId;
  userText: string;
  /** 0-100 */
  accuracy: number;
  mistakes: number;
  totalWords: number;
  completedAt: Date;
}

const exerciseResultSchema = new Schema<IExerciseResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    exerciseId: {
      type: Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },

    userText: {
      type: String,
      required: true,
      maxlength: 5000,
    },

    accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    mistakes: {
      type: Number,
      required: true,
      min: 0,
    },

    totalWords: {
      type: Number,
      required: true,
      min: 0,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// History for a user (newest first) and per-exercise lookups.
exerciseResultSchema.index({ userId: 1, completedAt: -1 });
exerciseResultSchema.index({ userId: 1, exerciseId: 1 });

export const ExerciseResult: Model<IExerciseResult> =
  mongoose.models.ExerciseResult ||
  mongoose.model<IExerciseResult>("ExerciseResult", exerciseResultSchema);
