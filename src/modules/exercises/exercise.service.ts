import { AppError } from "../../utils/app-error.js";
import { Exercise, type IExercise } from "./exercise.model.js";
import { ExerciseResult } from "./exercise-result.model.js";
import { scoreDictation } from "./exercise.scoring.js";
import type { ListExercisesQuery } from "./exercise.validation.js";

// The transcript (`text`) is deliberately not part of this projection:
// sending it before submission would give the dictation answer away.
const PUBLIC_FIELDS = "slug title description difficulty category audioUrl";

function toPublicExercise(exercise: IExercise) {
  return {
    id: exercise._id.toString(),
    slug: exercise.slug,
    title: exercise.title,
    description: exercise.description ?? null,
    difficulty: exercise.difficulty,
    category: exercise.category,
    audioUrl: exercise.audioUrl ?? null,
  };
}

export async function listExercises(query: ListExercisesQuery) {
  const filter: Record<string, unknown> = { published: true };

  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.category) filter.category = query.category;

  const [exercises, total] = await Promise.all([
    Exercise.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Exercise.countDocuments(filter),
  ]);

  return {
    items: exercises.map(toPublicExercise),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getExercise(id: string) {
  const exercise = await Exercise.findOne({
    _id: id,
    published: true,
  }).select(PUBLIC_FIELDS);

  if (!exercise) {
    throw new AppError("Exercise not found", 404);
  }

  return toPublicExercise(exercise);
}

export async function submitExercise(
  userId: string,
  exerciseId: string,
  userText: string
) {
  const exercise = await Exercise.findOne({
    _id: exerciseId,
    published: true,
  }).select("text");

  if (!exercise) {
    throw new AppError("Exercise not found", 404);
  }

  const { accuracy, mistakes, totalWords } = scoreDictation(
    exercise.text,
    userText
  );

  const result = await ExerciseResult.create({
    userId,
    exerciseId: exercise._id,
    userText,
    accuracy,
    mistakes,
    totalWords,
  });

  return {
    resultId: result._id.toString(),
    exerciseId: exercise._id.toString(),
    accuracy,
    mistakes,
    totalWords,
    // Safe to reveal now that the attempt is saved: lets the learner compare.
    transcript: exercise.text,
    completedAt: result.completedAt,
  };
}
