import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const STUDENT_STATUSES = ['active', 'inactive'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface IStudent {
  studentId: string;
  fullName: string;
  email: string;
  phone?: string;
  course: string;
  batch: string;
  admissionDate: Date;
  parent?: Types.ObjectId | null;
  user?: Types.ObjectId | null;
  feePlan?: Types.ObjectId | null;
  status: StudentStatus;
  /** Soft delete — financial history is never removed. */
  deletedAt?: Date | null;
}

const studentSchema = new Schema<IStudent>(
  {
    studentId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    course: { type: String, required: true, trim: true, maxlength: 80 },
    batch: { type: String, required: true, trim: true, maxlength: 80 },
    admissionDate: { type: Date, required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } } },
    feePlan: { type: Schema.Types.ObjectId, ref: 'FeeStructure', default: null },
    status: { type: String, enum: STUDENT_STATUSES, default: 'active', index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studentSchema.index({ course: 1, batch: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ deletedAt: 1, status: 1 });

studentSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export type StudentDoc = HydratedDocument<IStudent>;
export const Student = model<IStudent>('Student', studentSchema);
