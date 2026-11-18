import { z } from "zod";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_DIFFICULTIES,
} from "./exercise.model.js";

export const listExercisesQuerySchema = z.object({
  difficulty: z.enum(EXERCISE_DIFFICULTIES).optional(),
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const exerciseIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid exercise id"),
});

export const submitExerciseSchema = z.object({
  userText: z
    .string()
    .trim()
    .min(1, "Your answer cannot be empty")
    .max(5000, "Your answer cannot exceed 5000 characters"),
});

export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;
export type SubmitExerciseInput = z.infer<typeof submitExerciseSchema>;
