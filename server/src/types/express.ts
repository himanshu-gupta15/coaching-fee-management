import type { UserDoc } from '../models/User';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      /** Validated + coerced query/body/params (set by validate middleware) */
      valid?: { body?: any; query?: any; params?: any };
    }
  }
}
export {};
