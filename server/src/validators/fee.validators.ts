import { z } from 'zod';
import { dateString, objectId, pagination, paise } from './common';

export const structureSchema = z.object({
  name: z.string().trim().min(2).max(120),
  course: z.string().trim().min(1).max(80),
  frequency: z.enum(['monthly', 'quarterly', 'one_time']),
  amount: paise,
  dueDay: z.number().int().min(1).max(28).default(10),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});
export const structureUpdateSchema = structureSchema.partial();

export const feeListQuery = z.object({
  ...pagination,
  student: objectId.optional(),
  status: z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled', 'outstanding']).optional(),
  feeStructure: objectId.optional(),
  search: z.string().trim().max(100).optional(),
  dueFrom: dateString.optional(),
  dueTo: dateString.optional(),
  sort: z.enum(['dueDate', '-dueDate', 'amount', '-amount']).default('-dueDate'),
});

export const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM'),
  feeStructureId: objectId.optional(),
  studentIds: z.array(objectId).max(500).optional(),
  dueDate: dateString.optional(),
});

export const customFeeSchema = z.object({
  studentId: objectId,
  title: z.string().trim().min(2).max(160),
  amount: paise,
  dueDate: dateString,
  notes: z.string().trim().max(500).optional(),
});

export const updateFeeSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  amount: paise.optional(),
  dueDate: dateString.optional(),
  notes: z.string().trim().max(500).optional(),
});
export const cancelFeeSchema = z.object({ reason: z.string().trim().min(3).max(300) });
