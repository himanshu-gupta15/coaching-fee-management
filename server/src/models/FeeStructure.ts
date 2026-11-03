import { Schema, model, type HydratedDocument } from 'mongoose';

export const FREQUENCIES = ['monthly', 'quarterly', 'one_time'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface IFeeStructure {
  name: string;
  course: string;
  frequency: Frequency;
  /** Integer paise */
  amount: number;
  /** Day of month payment is due (1-28) */
  dueDay: number;
  description?: string;
  isActive: boolean;
}

const feeStructureSchema = new Schema<IFeeStructure>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
    course: { type: String, required: true, trim: true, maxlength: 80 },
    frequency: { type: String, enum: FREQUENCIES, required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'Amount must be an integer number of paise' },
    },
    dueDay: { type: Number, required: true, min: 1, max: 28, default: 10 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

feeStructureSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    return ret;
  },
});

export type FeeStructureDoc = HydratedDocument<IFeeStructure>;
export const FeeStructure = model<IFeeStructure>('FeeStructure', feeStructureSchema);
