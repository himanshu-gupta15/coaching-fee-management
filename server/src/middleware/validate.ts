import '../types/express';
import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Validates and coerces request parts. Unknown keys are stripped by default (z.object). */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.valid = req.valid ?? {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const flat = result.error.flatten();
        const first = result.error.issues[0];
        const message = first ? `${first.path.join('.') || part}: ${first.message}` : 'Invalid input';
        return next(new AppError(400, 'VALIDATION_ERROR', message, flat.fieldErrors));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
