import type { RequestHandler } from "express";
import mongoose from "mongoose";

import { User } from "../modules/auth/auth.model.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";
import { AppError } from "../utils/app-error.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  let userId: string;

  try {
    userId = verifyAccessToken(authorization.slice(7)).sub;
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid access token", 401);
  }

  const user = await User.findById(userId).select("_id isActive");

  if (!user || !user.isActive) {
    throw new AppError("User account is unavailable", 401);
  }

  req.auth = { userId: user._id.toString() };

  next();
};
