import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/common';
import { api, apiError } from '@/services/api';
import { useApi } from '@/hooks/useApi';
import { inr, isoDay, FREQ_LABEL } from '@/utils/format';
import type { FeeStructure, Student, User } from '@/types';

const NONE = '__none__';
const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the full name').max(120),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().regex(/^([+\d][\d\s-]{6,18})?$/, 'Enter a valid phone number').optional(),
    course: z.string().trim().min(1, 'Course is required').max(80),
    batch: z.string().trim().min(1, 'Batch is required').max(80),
    admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    parent: z.string(),
    feePlan: z.string(),
    status: z.enum(['active', 'inactive']),
    createLogin: z.boolean(),
    loginPassword: z.string().optional(),
  })
  .refine((v) => !v.createLogin || (v.loginPassword && /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(v.loginPassword)), {
    path: ['loginPassword'], message: 'At least 8 characters with a letter and a number',
  });
type FormValues = z.infer<typeof schema>;

export function StudentFormDialog({ open, onOpenChange, student, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; student?: Student | null; onSaved?: (s: Student) => void }) {
  const editing = Boolean(student);
  const parents = useApi<User[]>(open ? '/parents' : null, { limit: 100 });
  const plans = useApi<FeeStructure[]>(open ? '/fees/structures' : null);
  const { register, handleSubmit, control, reset, watch, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      fullName: student?.fullName ?? '', email: student?.email ?? '', phone: student?.phone ?? '',
      course: student?.course ?? '', batch: student?.batch ?? '',
      admissionDate: student ? isoDay(student.admissionDate) : isoDay(),
      parent: student?.parent?._id ?? NONE, feePlan: student?.feePlan?._id ?? NONE, status: student?.status ?? 'active',
      createLogin: false, loginPassword: '',
    });
  }, [open, student, reset]);

  const onSubmit = async (v: FormValues) => {
    const body: Record<string, unknown> = {
      fullName: v.fullName, email: v.email, phone: v.phone ?? '', course: v.course, batch: v.batch, admissionDate: v.admissionDate,
      parent: v.parent === NONE ? null : v.parent, feePlan: v.feePlan === NONE ? null : v.feePlan, status: v.status,
    };
    if (!editing && v.createLogin) Object.assign(body, { createLogin: true, loginPassword: v.loginPassword });
    try {
      const { data } = editing ? await api.patch(`/students/${student!._id}`, body) : await api.post('/students', body);
      toast.success(editing ? 'Student updated' : `Student ${data.data.fullName} added`, { description: editing ? undefined : `ID ${data.data.studentId}` });
      onSaved?.(data.data);
      onOpenChange(false);
    } catch (e) {
      const err = apiError(e);
      const field = err.message.split(':')[0];
      if (field in schema.innerType().shape) setError(field as keyof FormValues, { message: err.message.split(':').slice(1).join(':').trim() });
      else toast.error(err.message);
    }
  };

  const plan = plans.data?.find((p) => p._id === watch('feePlan'));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit student' : 'Add student'}</DialogTitle>
          <DialogDescription>{editing ? `${student!.studentId}` : 'A student ID is generated automatically.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required><Input id="fullName" {...register('fullName')} aria-invalid={!!errors.fullName} /></Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message} required><Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} /></Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}><Input id="phone" type="tel" placeholder="+91 98xxx xxxxx" {...register('phone')} /></Field>
            <Field label="Admission date" htmlFor="admissionDate" error={errors.admissionDate?.message} required><Input id="admissionDate" type="date" {...register('admissionDate')} /></Field>
            <Field label="Course / class" htmlFor="course" error={errors.course?.message} required><Input id="course" list="course-list" placeholder="e.g. NEET UG" {...register('course')} aria-invalid={!!errors.course} /></Field>
            <Field label="Batch" htmlFor="batch" error={errors.batch?.message} required><Input id="batch" placeholder="e.g. NEET-2027 Weekend" {...register('batch')} aria-invalid={!!errors.batch} /></Field>
            <datalist id="course-list">{[...new Set(plans.data?.map((p) => p.course))].map((c) => <option key={c} value={c} />)}</datalist>
            <Field label="Parent account" htmlFor="parent">
              <Controller control={control} name="parent" render={({ field }) => (
                <Select id="parent" value={field.value} onValueChange={field.onChange} options={[{ value: NONE, label: 'Not linked' }, ...(parents.data ?? []).map((p) => ({ value: p._id, label: `${p.name} (${p.email})` }))]} />
              )} />
            </Field>
            <Field label="Fee plan" htmlFor="feePlan" hint={plan ? `${inr(plan.amount)} · ${FREQ_LABEL[plan.frequency]}, due on day ${plan.dueDay}` : 'Used when generating fees'}>
              <Controller control={control} name="feePlan" render={({ field }) => (
                <Select id="feePlan" value={field.value} onValueChange={field.onChange} options={[{ value: NONE, label: 'No plan' }, ...(plans.data ?? []).filter((p) => p.isActive || p._id === field.value).map((p) => ({ value: p._id, label: p.name }))]} />
              )} />
            </Field>
            {editing && (
              <Field label="Status" htmlFor="status">
                <Controller control={control} name="status" render={({ field }) => (
                  <Select id="status" value={field.value} onValueChange={field.onChange} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive (paused)' }]} />
                )} />
              </Field>
            )}
          </div>
          {!editing && (
            <div className="rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3">
                <span><span className="block text-sm font-medium">Create student login</span><span className="text-xs text-muted-foreground">Lets the student view their own fee status.</span></span>
                <Controller control={control} name="createLogin" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Create student login" />} />
              </label>
              {watch('createLogin') && (
                <Field label="Initial password" htmlFor="loginPassword" error={errors.loginPassword?.message} className="mt-3">
                  <Input id="loginPassword" type="password" autoComplete="new-password" {...register('loginPassword')} />
                </Field>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editing ? 'Save changes' : 'Add student'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
