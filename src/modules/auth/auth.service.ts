import bcrypt from "bcryptjs";
import { User } from "./auth.model.js";
import type { RegisterInput } from "./auth.validation.js";
import { Session } from "./session.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
  getTokenExpirationDate,
} from "./auth.tokens.js";
import mongoose from "mongoose";

const SALT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function registerUser(input: RegisterInput) {
  const existingUser = await User.findOne({
    email: input.email,
  });

  if (existingUser) {
    throw new AuthError("Email is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(
    input.password,
    SALT_ROUNDS
  );

  try {
    const user = await User.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  } catch (error: unknown) {
    // Handle concurrent registrations for the same email.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AuthError("Email is already registered", 409);
    }

    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email }).select("+password");

  if (!user || !user.isActive) {
    throw new AuthError("Invalid email or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new AuthError("Invalid email or password", 401);
  }

  const userId = user._id.toString();

  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: getTokenExpirationDate(refreshToken),
  });

  return {
    user: {
      id: userId,
      name: user.name,
      email: user.email,
    },
    accessToken,
    refreshToken,
  };
}


export async function refreshUser(refreshToken: string) {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  if (!mongoose.isValidObjectId(payload.sub)) {
    throw new AuthError("Invalid refresh token", 401);
  }

  const user = await User.findById(payload.sub).select("_id isActive");

  if (!user || !user.isActive) {
    throw new AuthError("User account is unavailable", 401);
  }

  const newRefreshToken = generateRefreshToken(payload.sub!);
  const newAccessToken = generateAccessToken(payload.sub!);

  const session = await Session.findOneAndUpdate(
    {
      userId: payload.sub,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        refreshTokenHash: hashToken(newRefreshToken),
        expiresAt: getTokenExpirationDate(newRefreshToken),
      },
    },
    { new: true }
  );

  if (!session) {
    throw new AuthError("Session is invalid or expired", 401);
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logoutUser(refreshToken: string) {
  await Session.deleteOne({
    refreshTokenHash: hashToken(refreshToken),
  });
}
