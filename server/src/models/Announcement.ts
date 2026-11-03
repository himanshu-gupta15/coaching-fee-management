import { Schema, model, Types } from 'mongoose';

export const AUDIENCES = ['all', 'parents', 'students'] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface IAnnouncement {
  title: string;
  body: string;
  audience: Audience;
  pinned: boolean;
  createdBy: Types.ObjectId;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    audience: { type: String, enum: AUDIENCES, default: 'all', index: true },
    pinned: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

announcementSchema.index({ pinned: -1, createdAt: -1 });
announcementSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
