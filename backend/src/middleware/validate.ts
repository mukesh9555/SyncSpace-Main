import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { ValidationError } from "../types/errors.js";

type ValidationTarget = "body" | "query" | "params";

export function validate(
  schema: ZodSchema,
  target: ValidationTarget = "body",
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[target]);
      if (target === "query") {
        Object.defineProperty(req, "query", {
          value: { ...req.query, ...data },
          writable: true,
          configurable: true,
        });
      } else {
        req[target] = data;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(err.message);
        });
        next(new ValidationError(formattedErrors));
      } else {
        next(error);
      }
    }
  };
}
