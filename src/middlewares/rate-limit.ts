import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/** Brute-force protection for register / login / refresh. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many attempts, please try again later",
  },
});
