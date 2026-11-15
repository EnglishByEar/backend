import bcrypt from "bcryptjs";
import { User } from "./auth.model.js";
import type { RegisterInput } from "./auth.validation.js";
import { Session } from "./session.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "./auth.tokens.js";

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

  // Use the same error for unknown email and incorrect password.
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

  const refreshExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
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
