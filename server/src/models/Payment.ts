import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'online_manual'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface IPayment {
  transactionId: string;
  receiptNumber: string;
  feeRecord: Types.ObjectId;
  /** Denormalised for fast scoping/reporting; always equals feeRecord.student */
  student: Types.ObjectId;
  /** Integer paise, > 0 */
  amount: number;
  method: PaymentMethod;
  /** Bank UTR / cheque / external reference */
  reference?: string;
  paidAt: Date;
  recordedBy: Types.ObjectId;
  notes?: string;
  /** Client-generated key: the same submission can never create two payments */
  idempotencyKey: string;
  /** True for every payment in this MVP: recorded by staff, not verified by a gateway */
  manualEntry: boolean;
  /** Snapshot for receipts (balance on the fee record right after this payment) */
  balanceAfter: number;
}

const paymentSchema = new Schema<IPayment>(
  {
    transactionId: { type: String, required: true, unique: true },
    receiptNumber: { type: String, required: true, unique: true },
    feeRecord: { type: Schema.Types.ObjectId, ref: 'FeeRecord', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'Amount must be integer paise' },
    },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, trim: true, maxlength: 100 },
    paidAt: { type: Date, required: true, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, unique: true },
    manualEntry: { type: Boolean, default: true },
    balanceAfter: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// The same external reference (e.g. bank UTR) cannot be recorded twice for one method.
paymentSchema.index(
  { method: 1, reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: 'string', $gt: '' } } },
);

paymentSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.__v;
    delete ret.idempotencyKey;
    return ret;
  },
});

export type PaymentDoc = HydratedDocument<IPayment>;
export const Payment = model<IPayment>('Payment', paymentSchema);
