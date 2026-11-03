import { z } from 'zod';
import { dateString, pagination } from './common';

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(4000),
  audience: z.enum(['all', 'parents', 'students']).default('all'),
  pinned: z.boolean().default(false),
});
export const announcementUpdateSchema = announcementSchema.partial();
export const notificationListQuery = z.object({
  ...pagination,
  unread: z.enum(['true', 'false']).optional(),
});
export const rangeQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});
export const exportQuery = rangeQuery.extend({
  type: z.enum(['collections', 'payments', 'pending', 'overdue']),
});
export const auditQuery = z.object({
  ...pagination,
  action: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(40).optional(),
});
export const userListQuery = z.object({
  ...pagination,
  role: z.enum(['admin', 'parent', 'student']).optional(),
  search: z.string().trim().max(100).optional(),
});
