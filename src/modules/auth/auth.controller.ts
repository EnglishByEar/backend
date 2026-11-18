import type { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  refreshUser,
  logoutUser,
} from "./auth.service.js";
import type { RegisterInput, LoginInput } from "./auth.validation.js";
import { User } from "./auth.model.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";

// Express 5 forwards errors from async handlers to the error middleware,
// so no try/catch is needed here. Request bodies are validated in the routes.

const COOKIE_NAME = "refreshToken";

const baseCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
};

function setRefreshCookie(res: Response, token: string, expires: Date) {
  // Expiry comes from the token itself, so cookie and JWT can never disagree.
  res.cookie(COOKIE_NAME, token, { ...baseCookieOptions, expires });
}

export async function register(req: Request, res: Response) {
  const user = await registerUser(req.body as RegisterInput);

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    user,
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;

  const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
    await loginUser(email, password);

  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user,
    accessToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.[COOKIE_NAME];

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 401);
  }

  const tokens = await refreshUser(refreshToken);

  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);

  res.status(200).json({
    success: true,
    accessToken: tokens.accessToken,
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies?.[COOKIE_NAME];

  if (refreshToken) {
    await logoutUser(refreshToken);
  }

  res.clearCookie(COOKIE_NAME, baseCookieOptions);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

export async function me(req: Request, res: Response) {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const user = await User.findById(userId).select(
    "name email createdAt isActive"
  );

  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}
