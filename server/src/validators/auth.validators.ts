import { z } from 'zod';
import { email, password } from './common';

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(200) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });
