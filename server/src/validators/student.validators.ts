import { z } from 'zod';
import { objectId, pagination, dateString, email, phone, name, password } from './common';

export const studentListQuery = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  course: z.string().trim().max(80).optional(),
  batch: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  feeStatus: z.enum(['overdue', 'outstanding', 'clear']).optional(),
  parent: objectId.optional(),
  sort: z.enum(['name', '-name', 'admissionDate', '-admissionDate', 'studentId', '-createdAt']).default('name'),
});

const studentBase = {
  fullName: name,
  email,
  phone,
  course: z.string().trim().min(1, 'Course is required').max(80),
  batch: z.string().trim().min(1, 'Batch is required').max(80),
  admissionDate: dateString,
  parent: objectId.nullable().optional(),
  feePlan: objectId.nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
};

export const createStudentSchema = z.object({
  ...studentBase,
  studentId: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, 'Use 3-20 letters, numbers or dashes').optional(),
  /** Optional: create a student login at the same time */
  createLogin: z.boolean().optional(),
  loginPassword: password.optional(),
});

export const updateStudentSchema = z.object(studentBase).partial();

export const studentAccountSchema = z.object({ password });
