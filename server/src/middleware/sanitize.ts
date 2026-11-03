import type { NextFunction, Request, Response } from 'express';

/**
 * Strips keys that could be interpreted as MongoDB operators ("$gt", "a.b") from
 * request bodies. Query strings use Express 5's "simple" parser (no nested objects)
 * and every input is additionally validated with Zod.
 */
function clean(value: unknown, depth = 0): unknown {
  if (depth > 10) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor') continue;
      out[k] = clean(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}
