import { Router } from "express";
import { list, getOne, submit } from "./exercise.controller.js";
import {
  listExercisesQuerySchema,
  exerciseIdParamSchema,
  submitExerciseSchema,
} from "./exercise.validation.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.js";

const router = Router();

router.get("/", validate(listExercisesQuerySchema, "query"), list);

router.get("/:id", validate(exerciseIdParamSchema, "params"), getOne);

router.post(
  "/:id/submit",
  authenticate,
  validate(exerciseIdParamSchema, "params"),
  validate(submitExerciseSchema),
  submit
);

export default router;
