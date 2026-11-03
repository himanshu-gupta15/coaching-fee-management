import { Schema, model, Types } from 'mongoose';

export const NOTIFICATION_TYPES = ['fee_due', 'fee_overdue', 'payment_success', 'announcement', 'system'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  readAt?: Date | null;
  /** Prevents duplicate reminders, e.g. "overdue:<feeRecordId>:<yyyy-mm-dd>" */
  dedupeKey?: string;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 1000 },
    link: { type: String, maxlength: 300 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);

notificationSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    delete ret.dedupeKey;
    return ret;
  },
});

export const Notification = model<INotification>('Notification', notificationSchema);
