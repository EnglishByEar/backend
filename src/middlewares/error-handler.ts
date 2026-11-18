import type { ErrorRequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

/**
 * Errors thrown by Express itself (body-parser: invalid JSON, payload too
 * large, ...) carry a 4xx `status`. Those are client mistakes, not 500s.
 */
function getClientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const { status } = error as { status?: unknown };

  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : undefined;
}

function getClientErrorMessage(error: unknown): string {
  const { type } = error as { type?: unknown };

  if (type === "entity.parse.failed") return "Invalid JSON body";
  if (type === "entity.too.large") return "Request body is too large";

  return "Bad request";
}

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  const clientStatus = getClientErrorStatus(error);

  if (clientStatus) {
    res.status(clientStatus).json({
      success: false,
      message: getClientErrorMessage(error),
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Unknown error",
  });
};
