
import type { Request, Response, NextFunction } from "express";
import {
  registerUser,
  loginUser,
  refreshUser,
  logoutUser,
  AuthError,
} from "./auth.service.js";
import { registerSchema, loginSchema } from "./auth.validation.js";
import { User } from "./auth.model.js";
import { env } from "../../config/env.js";

const COOKIE_NAME = "refreshToken";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function handleError(
  error: unknown,
  next: NextFunction
) {
  next(error);
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        errors: result.error.issues,
      });
      return;
    }

    const user = await registerUser(result.data);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user,
    });
  } catch (error) {
    handleError(error, next);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        errors: result.error.issues,
      });
      return;
    }

    const { user, accessToken, refreshToken } =
      await loginUser(result.data.email, result.data.password);

    res.cookie(COOKIE_NAME, refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful",
      user,
      accessToken,
    });
  } catch (error) {
    handleError(error, next);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    const tokens = await refreshUser(refreshToken);

    res.cookie(
      COOKIE_NAME,
      tokens.refreshToken,
      cookieOptions
    );

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    handleError(error, next);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];

    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    handleError(error, next);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    console.log("Authenticated user ID:", req.auth?.userId);
    const userId = req.auth?.userId;

    if (!userId) {
      throw new AuthError("Authentication required", 401);
    }

    const user = await User.findById(userId)
      .select("name email createdAt isActive");

    if (!user || !user.isActive) {
      throw new AuthError("User not found", 404);
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
  } catch (error) {
    next(error);
  }
}
