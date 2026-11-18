import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  me,
} from "./auth.controller.js";
import { registerSchema, loginSchema } from "./auth.validation.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { validate } from "../../middlewares/validate.js";
import { authLimiter } from "../../middlewares/rate-limit.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", logout);

router.get("/me", authenticate, me);

export default router;
