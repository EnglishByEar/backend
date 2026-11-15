
import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "../config/env.js";
import { User } from "../modules/auth/auth.model.js";

export const authenticate: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const token = authorization.slice(7);

    let decoded: string | JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch {
      res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
      return;
    }

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
      return;
    }

    const user = await User.findById(decoded.sub).select("_id isActive");

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: "User account is unavailable",
      });
      return;
    }

    Object.assign(req, {
      auth: {
        userId: user._id.toString(),
      },
    });

    next();
  } catch (error) {
    next(error);
  }
};
