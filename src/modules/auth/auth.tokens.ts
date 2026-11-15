import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID, createHash } from "node:crypto";
import { env } from "../../config/env.js";

export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { sub: userId },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    }
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      jti: randomUUID(),
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    }
  );
}

export function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}
