import { z } from 'zod';
import { email, name, objectId, pagination, password, phone } from './common';

export const parentListQuery = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export const createParentSchema = z.object({
  name,
  email,
  phone,
  password,
  studentIds: z.array(objectId).max(20).optional(),
});
export const updateParentSchema = z.object({ name, email, phone, isActive: z.boolean() }).partial();
export const linkStudentSchema = z.object({ studentId: objectId });
export const linkParams = z.object({ id: objectId, studentId: objectId });
