import { Schema, model, Types } from 'mongoose';

export interface IAuditLog {
  actor?: Types.ObjectId | null;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: String,
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, index: true },
    summary: { type: String, required: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
