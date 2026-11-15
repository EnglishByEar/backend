
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
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

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.jti !== "string" ||
    typeof decoded.exp !== "number"
  ) {
    throw new Error("Invalid refresh token");
  }

  return decoded;
}

export function getTokenExpirationDate(token: string): Date {
  const decoded = jwt.decode(token) as JwtPayload | null;

  if (!decoded?.exp) {
    throw new Error("Token expiration is missing");
  }

  return new Date(decoded.exp * 1000);
}
