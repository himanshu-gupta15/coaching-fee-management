import { z } from 'zod';
import { dateString, objectId, pagination, paise } from './common';

export const recordPaymentSchema = z
  .object({
    feeRecordId: objectId,
    amount: paise,
    method: z.enum(['cash', 'bank_transfer', 'online_manual']),
    reference: z.string().trim().max(100).optional(),
    paidAt: dateString.optional(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(100),
  })
  .refine((v) => v.method === 'cash' || (v.reference && v.reference.length >= 3), {
    message: 'A transaction reference is required for bank and online payments',
    path: ['reference'],
  });

export const paymentListQuery = z.object({
  ...pagination,
  student: objectId.optional(),
  feeRecord: objectId.optional(),
  method: z.enum(['cash', 'bank_transfer', 'online_manual']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  search: z.string().trim().max(100).optional(),
});
