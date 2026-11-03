import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common';
import { api, errMsg } from '@/services/api';
import type { User } from '@/types';

const base = {
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^([+\d][\d\s-]{6,18})?$/, 'Enter a valid phone number').optional(),
};
const createSchema = z.object({ ...base, password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, 'At least 8 characters with a letter and a number') });
const editSchema = z.object({ ...base, password: z.string().optional() });
type FormValues = z.infer<typeof editSchema>;

export function ParentFormDialog({ open, onOpenChange, parent, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; parent?: User | null; onSaved?: () => void }) {
  const editing = Boolean(parent);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(editing ? editSchema : createSchema) });
  useEffect(() => {
    if (open) reset({ name: parent?.name ?? '', email: parent?.email ?? '', phone: parent?.phone ?? '', password: '' });
  }, [open, parent, reset]);

  const onSubmit = async (v: FormValues) => {
    try {
      if (editing) await api.patch(`/parents/${parent!._id}`, { name: v.name, email: v.email, phone: v.phone ?? '' });
      else await api.post('/parents', { name: v.name, email: v.email, phone: v.phone ?? '', password: v.password });
      toast.success(editing ? 'Parent updated' : 'Parent account created');
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit parent' : 'Add parent account'}</DialogTitle>
          <DialogDescription>{editing ? 'Update contact details.' : 'Share the email and initial password with the parent securely. They can change it after signing in.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Full name" htmlFor="p-name" error={errors.name?.message} required><Input id="p-name" {...register('name')} aria-invalid={!!errors.name} /></Field>
          <Field label="Email" htmlFor="p-email" error={errors.email?.message} required><Input id="p-email" type="email" {...register('email')} aria-invalid={!!errors.email} /></Field>
          <Field label="Phone" htmlFor="p-phone" error={errors.phone?.message}><Input id="p-phone" type="tel" {...register('phone')} /></Field>
          {!editing && <Field label="Initial password" htmlFor="p-password" error={errors.password?.message} required><Input id="p-password" type="password" autoComplete="new-password" {...register('password')} aria-invalid={!!errors.password} /></Field>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Create account'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
