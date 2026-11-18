import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type RequestSource = "body" | "query" | "params";

/**
 * Validates part of the request with a Zod schema. On success the parsed
 * (trimmed / coerced / defaulted) data replaces the original value.
 */
export function validate(
  schema: ZodType,
  source: RequestSource = "body"
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json({
        success: false,
        errors: result.error.issues,
      });
      return;
    }

    // `req.query` is a getter in Express 5, so redefine it instead of assigning.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    next();
  };
}
