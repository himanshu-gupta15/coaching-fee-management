import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const ROLES = ['admin', 'parent', 'student'] as const;
export type Role = (typeof ROLES)[number];

export interface IUser {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  createdBy?: Types.ObjectId;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    resetTokenHash: { type: String, select: false, index: { sparse: true } },
    resetTokenExpiresAt: { type: Date, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, name: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpiresAt;
    delete ret.__v;
    return ret;
  },
});

export type UserDoc = HydratedDocument<IUser>;
export const User = model<IUser>('User', userSchema);
