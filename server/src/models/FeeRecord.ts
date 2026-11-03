import { Schema, model, Types, type HydratedDocument } from 'mongoose';

/**
 * Stored payment state. "overdue" is NOT stored — it is derived from dueDate and
 * the outstanding balance at read time so it can never go stale.
 */
export const FEE_RECORD_STATES = ['pending', 'partial', 'paid', 'cancelled'] as const;
export type FeeRecordState = (typeof FEE_RECORD_STATES)[number];
export type EffectiveFeeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface IFeeRecord {
  student: Types.ObjectId;
  feeStructure?: Types.ObjectId | null;
  title: string;
  /** Idempotency key for generation, e.g. "2026-11", "2026-Q4", "ONE_TIME", "CUSTOM-xxxx" */
  periodKey: string;
  /** Integer paise */
  amount: number;
  /**
   * Running total of completed payments (integer paise). Only ever changed by the
   * payment service inside the same atomic operation that creates the Payment.
   */
  amountPaid: number;
  dueDate: Date;
  status: FeeRecordState;
  paidAt?: Date | null;
  notes?: string;
  cancelledReason?: string;
  createdBy?: Types.ObjectId;
}

const int = { validator: Number.isSafeInteger, message: 'Must be an integer number of paise' };

const feeRecordSchema = new Schema<IFeeRecord>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    feeStructure: { type: Schema.Types.ObjectId, ref: 'FeeStructure', default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    periodKey: { type: String, required: true },
    amount: { type: Number, required: true, min: 1, validate: int },
    amountPaid: { type: Number, required: true, min: 0, default: 0, validate: int },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: FEE_RECORD_STATES, default: 'pending' },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500 },
    cancelledReason: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Prevents generating the same period twice for a student + fee plan.
feeRecordSchema.index({ student: 1, feeStructure: 1, periodKey: 1 }, { unique: true });
feeRecordSchema.index({ status: 1, dueDate: 1 });
feeRecordSchema.index({ student: 1, dueDate: -1 });

feeRecordSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export type FeeRecordDoc = HydratedDocument<IFeeRecord>;
export const FeeRecord = model<IFeeRecord>('FeeRecord', feeRecordSchema);
