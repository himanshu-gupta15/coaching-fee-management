import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/common';
import { api, errMsg } from '@/services/api';
import { useApi } from '@/hooks/useApi';
import { currentPeriod, inr, isoDay, paiseToRupeeInput, rupeesToPaise } from '@/utils/format';
import type { FeeRecord, FeeStructure, Student } from '@/types';

const money = z.string().refine((v) => { const p = rupeesToPaise(v); return p !== null && p > 0; }, 'Enter a valid amount, e.g. 4500');

// ---------------- Fee plan ----------------
const planSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  course: z.string().trim().min(1, 'Course is required').max(80),
  frequency: z.enum(['monthly', 'quarterly', 'one_time']),
  amount: money,
  dueDay: z.coerce.number().int().min(1, '1–28').max(28, '1–28'),
  description: z.string().max(500).optional(),
  isActive: z.boolean(),
});
type PlanValues = z.infer<typeof planSchema>;

export function FeeStructureDialog({ open, onOpenChange, plan, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; plan?: FeeStructure | null; onSaved?: () => void }) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<PlanValues>({ resolver: zodResolver(planSchema) });
  useEffect(() => {
    if (open) reset({ name: plan?.name ?? '', course: plan?.course ?? '', frequency: plan?.frequency ?? 'monthly', amount: plan ? paiseToRupeeInput(plan.amount) : '', dueDay: plan?.dueDay ?? 10, description: plan?.description ?? '', isActive: plan?.isActive ?? true });
  }, [open, plan, reset]);
  const onSubmit = async (v: PlanValues) => {
    const body = { ...v, amount: rupeesToPaise(v.amount) };
    try {
      if (plan) await api.patch(`/fees/structures/${plan._id}`, body);
      else await api.post('/fees/structures', body);
      toast.success(plan ? 'Fee plan updated' : 'Fee plan created');
      onSaved?.();
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit fee plan' : 'New fee plan'}</DialogTitle>
          <DialogDescription>{plan ? 'Changes apply to fees generated from now on. Existing fee records are not modified.' : 'Fee plans are assigned to students and used to generate fee records.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Plan name" htmlFor="pl-name" error={errors.name?.message} required><Input id="pl-name" placeholder="e.g. NEET UG (Monthly)" {...register('name')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course" htmlFor="pl-course" error={errors.course?.message} required><Input id="pl-course" {...register('course')} /></Field>
            <Field label="Frequency" htmlFor="pl-freq" required>
              <Controller control={control} name="frequency" render={({ field }) => (
                <Select id="pl-freq" value={field.value} onValueChange={field.onChange} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'one_time', label: 'One-time' }]} />
              )} />
            </Field>
            <Field label="Amount (₹)" htmlFor="pl-amount" error={errors.amount?.message} required><Input id="pl-amount" inputMode="decimal" {...register('amount')} /></Field>
            <Field label="Due day of month" htmlFor="pl-due" error={errors.dueDay?.message} required><Input id="pl-due" type="number" min={1} max={28} {...register('dueDay')} /></Field>
          </div>
          <Field label="Description" htmlFor="pl-desc"><Textarea id="pl-desc" rows={2} {...register('description')} /></Field>
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium">
            Active
            <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Active" />} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{plan ? 'Save' : 'Create plan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Generate ----------------
const ALL = '__all__';
export function GenerateFeesDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const plans = useApi<FeeStructure[]>(open ? '/fees/structures' : null);
  const [period, setPeriod] = useState(currentPeriod());
  const [planId, setPlanId] = useState(ALL);
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; studentsConsidered: number } | null>(null);
  useEffect(() => { if (open) { setResult(null); setPeriod(currentPeriod()); setPlanId(ALL); setDueDate(''); } }, [open]);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/fees/generate', { period, feeStructureId: planId === ALL ? undefined : planId, dueDate: dueDate || undefined });
      setResult(data.data);
      toast.success(`${data.data.created} fee records generated`);
      onDone?.();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate fee records</DialogTitle>
          <DialogDescription>Creates fees for every active student on a fee plan. Safe to run again — students who already have a fee for the period are skipped.</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-emerald-50 p-3"><p className="text-2xl font-semibold text-emerald-700">{result.created}</p><p className="text-xs text-emerald-800">Created</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-semibold">{result.skipped}</p><p className="text-xs text-muted-foreground">Already existed</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-semibold">{result.studentsConsidered}</p><p className="text-xs text-muted-foreground">Students</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Parents and students have been notified in-app about new fees.</p>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Billing month" htmlFor="g-period" hint="Quarterly plans create one fee per quarter; one-time plans only once." required>
              <Input id="g-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </Field>
            <Field label="Fee plan" htmlFor="g-plan">
              <Select id="g-plan" value={planId} onValueChange={setPlanId} options={[{ value: ALL, label: 'All active plans' }, ...(plans.data ?? []).filter((p) => p.isActive).map((p) => ({ value: p._id, label: `${p.name} · ${p.studentCount ?? 0} students` }))]} />
            </Field>
            <Field label="Override due date (optional)" htmlFor="g-due" hint="Leave empty to use each plan's due day.">
              <Input id="g-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} loading={busy} disabled={!/^\d{4}-\d{2}$/.test(period)}>Generate</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Custom / edit fee ----------------
const feeSchema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  title: z.string().trim().min(2, 'Enter a title').max(160),
  amount: money,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  notes: z.string().max(500).optional(),
});
type FeeValues = z.infer<typeof feeSchema>;

export function FeeRecordDialog({ open, onOpenChange, fee, student, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; fee?: FeeRecord | null; student?: Pick<Student, '_id' | 'fullName'> | null; onSaved?: () => void;
}) {
  const editing = Boolean(fee);
  const students = useApi<Student[]>(open && !student && !editing ? '/students' : null, { limit: 100, status: 'active' });
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FeeValues>({ resolver: zodResolver(feeSchema) });
  useEffect(() => {
    if (!open) return;
    const sid = fee ? (typeof fee.student === 'object' ? fee.student._id : fee.student) : student?._id ?? '';
    reset({ studentId: sid, title: fee?.title ?? '', amount: fee ? paiseToRupeeInput(fee.amount) : '', dueDate: fee ? isoDay(fee.dueDate) : isoDay(new Date(Date.now() + 7 * 86400000)), notes: fee?.notes ?? '' });
  }, [open, fee, student, reset]);
  const onSubmit = async (v: FeeValues) => {
    const amount = rupeesToPaise(v.amount)!;
    try {
      if (editing) await api.patch(`/fees/records/${fee!._id}`, { title: v.title, amount, dueDate: v.dueDate, notes: v.notes });
      else await api.post('/fees/records', { studentId: v.studentId, title: v.title, amount, dueDate: v.dueDate, notes: v.notes || undefined });
      toast.success(editing ? 'Fee updated' : 'Fee added');
      onSaved?.();
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit fee' : 'Add one-off fee'}</DialogTitle>
          <DialogDescription>
            {editing ? `Already paid: ${inr(fee!.amountPaid)}. The amount cannot be set below this.` : 'For exam fees, study material, trips or other one-off charges.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {!editing && !student && (
            <Field label="Student" htmlFor="f-student" error={errors.studentId?.message} required>
              <Controller control={control} name="studentId" render={({ field }) => (
                <Select id="f-student" value={field.value} onValueChange={field.onChange} placeholder="Select student" invalid={!!errors.studentId}
                  options={(students.data ?? []).map((s) => ({ value: s._id, label: `${s.fullName} (${s.studentId})` }))} />
              )} />
            </Field>
          )}
          {student && <p className="rounded-lg bg-slate-50 p-3 text-sm">Student: <span className="font-medium">{student.fullName}</span></p>}
          <Field label="Title" htmlFor="f-title" error={errors.title?.message} required><Input id="f-title" placeholder="e.g. Board exam registration" {...register('title')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (₹)" htmlFor="f-amount" error={errors.amount?.message} required><Input id="f-amount" inputMode="decimal" {...register('amount')} /></Field>
            <Field label="Due date" htmlFor="f-due" error={errors.dueDate?.message} required><Input id="f-due" type="date" {...register('dueDate')} /></Field>
          </div>
          <Field label="Notes" htmlFor="f-notes"><Textarea id="f-notes" rows={2} {...register('notes')} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editing ? 'Save' : 'Add fee'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
