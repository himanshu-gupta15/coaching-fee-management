import type { Request } from 'express';
import { Types } from 'mongoose';
import { FeeRecord } from '../models/FeeRecord';
import { Payment, type PaymentMethod, type PaymentDoc } from '../models/Payment';
import { Student } from '../models/Student';
import { AppError } from '../utils/AppError';
import { generateReceiptNumber, generateTransactionId } from '../utils/ids';
import { formatINR } from '../utils/money';
import { audit } from './audit.service';
import { withTransaction } from './transaction';
import { notifyMany } from './notification.service';
import { parentAndStudentUsers } from './fee.service';

export interface RecordPaymentInput {
  feeRecordId: string;
  /** Integer paise */
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt?: Date;
  notes?: string;
  idempotencyKey: string;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  online_manual: 'Online (manually recorded — not gateway-verified)',
};

/**
 * Records a payment against a fee record.
 *
 * Guarantees:
 *  - amount is a positive integer (paise) and never exceeds the outstanding balance
 *  - the fee record is updated with a single conditional atomic update, so two
 *    concurrent payments can never push amountPaid past amount
 *  - the same idempotencyKey (one form submission) can never create two payments
 *  - the same (method, reference) e.g. bank UTR can never be recorded twice
 *  - status becomes "paid" only when amountPaid === amount, and only via a payment
 *  - Payment + FeeRecord + AuditLog are written in one transaction where supported
 */
export async function recordPayment(req: Request, input: RecordPaymentInput): Promise<PaymentDoc> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw AppError.unprocessable('INVALID_AMOUNT', 'Payment amount must be a positive amount');
  }
  if (!Types.ObjectId.isValid(input.feeRecordId)) throw AppError.notFound('Fee record not found');

  const existing = await Payment.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    throw AppError.conflict('This payment has already been recorded', { paymentId: existing._id, transactionId: existing.transactionId });
  }
  const reference = input.reference?.trim() || undefined;
  if (reference) {
    const dupRef = await Payment.findOne({ method: input.method, reference });
    if (dupRef) {
      throw AppError.conflict(`A ${METHOD_LABELS[input.method].toLowerCase()} payment with reference "${reference}" already exists`, {
        paymentId: dupRef._id,
        transactionId: dupRef.transactionId,
      });
    }
  }
  const paidAt = input.paidAt ?? new Date();
  if (paidAt.getTime() > Date.now() + 5 * 60_000) {
    throw AppError.unprocessable('INVALID_DATE', 'Payment date cannot be in the future');
  }

  try {
    const payment = await withTransaction(async (session) => {
      // Atomic guard: only succeeds if the record is payable and the payment fits.
      const fee = await FeeRecord.findOneAndUpdate(
        {
          _id: input.feeRecordId,
          status: { $in: ['pending', 'partial'] },
          $expr: { $lte: [{ $add: ['$amountPaid', input.amount] }, '$amount'] },
        },
        [
          { $set: { amountPaid: { $add: ['$amountPaid', input.amount] } } },
          {
            $set: {
              status: { $cond: [{ $gte: ['$amountPaid', '$amount'] }, 'paid', 'partial'] },
              paidAt: { $cond: [{ $gte: ['$amountPaid', '$amount'] }, paidAt, null] },
            },
          },
        ],
        { new: true, session },
      );

      if (!fee) {
        const current = await FeeRecord.findById(input.feeRecordId).session(session ?? null);
        if (!current) throw AppError.notFound('Fee record not found');
        if (current.status === 'cancelled') throw AppError.unprocessable('FEE_CANCELLED', 'This fee has been cancelled');
        if (current.status === 'paid') throw AppError.unprocessable('ALREADY_PAID', 'This fee is already fully paid');
        const outstanding = current.amount - current.amountPaid;
        throw AppError.unprocessable(
          'OVERPAYMENT',
          `Payment of ${formatINR(input.amount)} exceeds the outstanding balance of ${formatINR(outstanding)}`,
          { outstanding },
        );
      }

      const student = await Student.findById(fee.student).session(session ?? null);
      if (!student) throw AppError.notFound('Student not found');

      const [p] = await Payment.create(
        [
          {
            transactionId: generateTransactionId(paidAt),
            receiptNumber: generateReceiptNumber(paidAt),
            feeRecord: fee._id,
            student: fee.student,
            amount: input.amount,
            method: input.method,
            reference,
            paidAt,
            recordedBy: req.user!._id,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
            manualEntry: true,
            balanceAfter: fee.amount - fee.amountPaid,
          },
        ],
        { session },
      );

      await audit(
        req,
        {
          action: 'payment.recorded',
          entityType: 'Payment',
          entityId: String(p._id),
          summary: `Recorded ${formatINR(input.amount)} (${METHOD_LABELS[input.method]}) for ${student.fullName} — ${fee.title}`,
          metadata: {
            feeRecord: String(fee._id),
            student: String(student._id),
            amount: input.amount,
            method: input.method,
            reference,
            transactionId: p.transactionId,
            balanceAfter: p.balanceAfter,
            feeStatus: fee.status,
          },
        },
        session,
      );
      return { payment: p, fee, student };
    });

    // Notifications are best-effort and outside the financial transaction.
    const { recipients } = await parentAndStudentUsers(payment.student._id);
    await notifyMany(
      recipients.map((user) => ({
        user,
        type: 'payment_success' as const,
        title: 'Payment received',
        message: `${formatINR(payment.payment.amount)} received for ${payment.student.fullName} — ${payment.fee.title}. Receipt ${payment.payment.receiptNumber}.${
          payment.fee.status === 'paid' ? ' This fee is now fully paid.' : ` Remaining: ${formatINR(payment.payment.balanceAfter)}.`
        }`,
        link: `/payments/${payment.payment._id}`,
        dedupeKey: `payment:${payment.payment._id}`,
      })),
    ).catch(() => undefined);

    return payment.payment;
  } catch (err: unknown) {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e.code === 11000) {
      if (e.keyPattern?.idempotencyKey) throw AppError.conflict('This payment has already been recorded');
      if (e.keyPattern?.reference) throw AppError.conflict('A payment with this reference already exists');
    }
    throw err;
  }
}
