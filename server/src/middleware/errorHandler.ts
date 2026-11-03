import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { isProd } from '../config/env';
import { AppError } from '../utils/AppError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let error: AppError;
  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]]));
    error = new AppError(400, 'VALIDATION_ERROR', Object.values(err.errors)[0]?.message ?? 'Invalid data', details);
  } else if (err instanceof mongoose.Error.CastError) {
    error = new AppError(400, 'INVALID_ID', `Invalid value for ${err.path}`);
  } else if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    const keys = Object.keys((err as { keyValue?: object }).keyValue ?? {});
    error = AppError.conflict(`A record with this ${keys.join(', ') || 'value'} already exists`, { fields: keys });
  } else if (typeof err === 'object' && err && (err as { type?: string }).type === 'entity.parse.failed') {
    error = AppError.badRequest('Malformed JSON body');
  } else {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'test') console.error(err);
    error = new AppError(500, 'INTERNAL_ERROR', isProd ? 'Something went wrong' : String((err as Error)?.message ?? err));
  }
  res.status(error.statusCode).json({
    success: false,
    error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
  });
}
