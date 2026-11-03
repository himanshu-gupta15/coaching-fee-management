import type { Request } from 'express';
import type { ClientSession } from 'mongoose';
import { AuditLog } from '../models/AuditLog';

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function audit(req: Request | null, input: AuditInput, session?: ClientSession) {
  await AuditLog.create(
    [
      {
        ...input,
        actor: req?.user?._id ?? null,
        actorRole: req?.user?.role ?? 'system',
        ip: req?.ip,
      },
    ],
    { session },
  );
}
