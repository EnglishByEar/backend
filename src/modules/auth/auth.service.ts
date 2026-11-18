import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AppError } from "../../utils/app-error.js";
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

const SALT_ROUNDS = 12;

/**
 * Two parallel refreshes (e.g. two browser tabs) legitimately present the same
 * token within a moment of each other. Inside this window a replayed token is
 * just rejected; after it, a replay is treated as theft and kills the session.
 */
const REUSE_GRACE_MS = 10_000;

// Compared against when the email is unknown, so response time does not reveal
// whether an account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "dummy-password-for-timing",
  SALT_ROUNDS
);

export async function registerUser(input: RegisterInput) {
  const existingUser = await User.findOne({
    email: input.email,
  });

  if (existingUser) {
    throw new AppError("Email is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

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
      throw new AppError("Email is already registered", 409);
    }

    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email }).select("+password");

  const isPasswordValid = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH
  );

  if (!user || !user.isActive || !isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const userId = user._id.toString();

  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  const refreshTokenExpiresAt = getTokenExpirationDate(refreshToken);

  await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  return {
    user: {
      id: userId,
      name: user.name,
      email: user.email,
    },
    accessToken,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export async function refreshUser(refreshToken: string) {
  let payload: ReturnType<typeof verifyRefreshToken>;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (!mongoose.isValidObjectId(payload.sub)) {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findById(payload.sub).select("_id isActive");

  if (!user || !user.isActive) {
    throw new AppError("User account is unavailable", 401);
  }

  const userId = user._id.toString();
  const currentHash = hashToken(refreshToken);
  const now = new Date();

  const newRefreshToken = generateRefreshToken(userId);
  const newExpiresAt = getTokenExpirationDate(newRefreshToken);

  // Atomic rotation: only one request can swap a given token for a new one.
  const session = await Session.findOneAndUpdate(
    {
      userId: user._id,
      refreshTokenHash: currentHash,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        refreshTokenHash: hashToken(newRefreshToken),
        previousRefreshTokenHash: currentHash,
        rotatedAt: now,
        expiresAt: newExpiresAt,
      },
    },
    { returnDocument: "after" }
  );

  if (!session) {
    // A correctly signed token with no live session: if it is one that was
    // already rotated away, someone is replaying it. Revoke that session.
    await Session.deleteOne({
      userId: user._id,
      previousRefreshTokenHash: currentHash,
      rotatedAt: { $lt: new Date(now.getTime() - REUSE_GRACE_MS) },
    });

    throw new AppError("Session is invalid or expired", 401);
  }

  return {
    accessToken: generateAccessToken(userId),
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: newExpiresAt,
  };
}

export async function logoutUser(refreshToken: string) {
  await Session.deleteOne({
    refreshTokenHash: hashToken(refreshToken),
  });
}
