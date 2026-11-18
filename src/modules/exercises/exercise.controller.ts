import type { Request, Response } from "express";
import { AppError } from "../../utils/app-error.js";
import {
  listExercises,
  getExercise,
  submitExercise,
} from "./exercise.service.js";
import type {
  ListExercisesQuery,
  SubmitExerciseInput,
} from "./exercise.validation.js";

export async function list(req: Request, res: Response) {
  const result = await listExercises(req.query as unknown as ListExercisesQuery);

  res.status(200).json({ success: true, ...result });
}

export async function getOne(req: Request<{ id: string }>, res: Response) {
  const exercise = await getExercise(req.params.id);

  res.status(200).json({ success: true, exercise });
}

export async function submit(req: Request<{ id: string }>, res: Response) {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const { userText } = req.body as SubmitExerciseInput;

  const result = await submitExercise(userId, req.params.id, userText);

  res.status(201).json({ success: true, result });
}
