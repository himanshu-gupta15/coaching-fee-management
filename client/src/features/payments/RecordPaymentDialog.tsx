import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, Banknote, Building2, CheckCircle2, Download, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field, ProgressBar, StatusBadge } from '@/components/common';
import { cn } from '@/lib/utils';
import { api, apiError, downloadFile } from '@/services/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { fmtDate, inr, isoDay, paiseToRupeeInput, rupeesToPaise } from '@/utils/format';
import type { FeeRecord, Payment, Student } from '@/types';

const schema = z
  .object({
    amount: z.string().min(1, 'Enter an amount'),
    method: z.enum(['cash', 'bank_transfer', 'online_manual']),
    reference: z.string().trim().max(100).optional(),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.method === 'cash' || (v.reference && v.reference.length >= 3), { path: ['reference'], message: 'Reference / UTR is required for bank and online payments' });
type FormValues = z.infer<typeof schema>;

const METHODS = [
  { value: 'cash', label: 'Cash', sub: 'At the office', icon: Banknote },
  { value: 'bank_transfer', label: 'Bank transfer', sub: 'NEFT / IMPS', icon: Building2 },
  { value: 'online_manual', label: 'UPI / card', sub: 'Manual entry', icon: Smartphone },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Pre-selected fee; if omitted the admin picks a student and fee first. */
  fee?: FeeRecord | null;
  studentName?: string;
  onRecorded?: () => void;
}

function FeePicker({ onPick }: { onPick: (f: FeeRecord) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [studentId, setStudentId] = useState('');
  const students = useApi<Student[]>('/students', { search: dq, limit: 8 });
  const fees = useApi<FeeRecord[]>(studentId ? '/fees/records' : null, { student: studentId, status: 'outstanding', sort: 'dueDate', limit: 50 });
  return (
    <div className="space-y-4">
      <Field label="Student" htmlFor="pick-student">
        <Input id="pick-student" placeholder="Search by name or student ID" value={q} onChange={(e) => { setQ(e.target.value); setStudentId(''); }} />
      </Field>
      {!studentId && (
        <div className="max-h-56 divide-y overflow-y-auto rounded-lg border">
          {students.loading && !students.data ? <p className="p-3 text-sm text-muted-foreground">Loading…</p> : null}
          {students.data?.length === 0 && <p className="p-3 text-sm text-muted-foreground">No students found</p>}
          {students.data?.map((s) => (
            <button key={s._id} type="button" onClick={() => { setStudentId(s._id); setQ(s.fullName); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
              <span><span className="text-sm font-medium">{s.fullName}</span><span className="ml-2 text-xs text-muted-foreground">{s.studentId}</span></span>
              <span className="text-xs tabular text-muted-foreground">{s.fees?.outstanding ? `${inr(s.fees.outstanding)} due` : 'No dues'}</span>
            </button>
          ))}
        </div>
      )}
      {studentId && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Select the fee being paid</p>
          {fees.loading && !fees.data && <p className="text-sm text-muted-foreground">Loading fees…</p>}
          {fees.data?.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">This student has no outstanding fees.</p>}
          <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {fees.data?.map((f) => (
              <button key={f._id} type="button" onClick={() => onPick(f)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{f.title}</span><span className="text-xs text-muted-foreground">Due {fmtDate(f.dueDate)}</span></span>
                <span className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-semibold tabular">{inr(f.balance)}</span><StatusBadge status={f.effectiveStatus} /></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RecordPaymentDialog({ open, onOpenChange, fee: initialFee, studentName, onRecorded }: Props) {
  const [fee, setFee] = useState<FeeRecord | null>(initialFee ?? null);
  const [idempotencyKey, setKey] = useState(() => crypto.randomUUID());
  const [done, setDone] = useState<Payment | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', method: 'cash', reference: '', paidAt: isoDay(), notes: '' },
  });

  useEffect(() => {
    if (open) {
      setFee(initialFee ?? null);
      setKey(crypto.randomUUID()); // one key per opened form => server rejects double submits
      setDone(null);
      setServerError(null);
      reset({ amount: initialFee ? paiseToRupeeInput(initialFee.balance) : '', method: 'cash', reference: '', paidAt: isoDay(), notes: '' });
    }
  }, [open, initialFee, reset]);

  const method = watch('method');
  const amountStr = watch('amount');
  const amountPaise = useMemo(() => rupeesToPaise(amountStr ?? ''), [amountStr]);
  const sName = studentName ?? (typeof fee?.student === 'object' ? fee.student.fullName : '');
  const remaining = fee && amountPaise !== null ? fee.balance - amountPaise : null;

  const onSubmit = async (v: FormValues) => {
    if (!fee) return;
    setServerError(null);
    const paise = rupeesToPaise(v.amount);
    if (paise === null || paise <= 0) return setServerError('Enter a valid amount, e.g. 2500 or 2500.50');
    if (paise > fee.balance) return setServerError(`Amount exceeds the outstanding balance of ${inr(fee.balance)}`);
    try {
      const { data } = await api.post('/payments', {
        feeRecordId: fee._id, amount: paise, method: v.method, reference: v.reference || undefined, paidAt: v.paidAt, notes: v.notes || undefined, idempotencyKey,
      });
      setDone(data.data.payment);
      toast.success(`Payment of ${inr(paise)} recorded`, { description: data.data.payment.transactionId });
      onRecorded?.();
    } catch (e) {
      const err = apiError(e);
      setServerError(err.message);
      if (err.code === 'OVERPAYMENT' && typeof err.details?.outstanding === 'number') setFee({ ...fee, balance: err.details.outstanding as number });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
            <DialogTitle>Payment recorded</DialogTitle>
            <DialogDescription className="mt-1">{inr(done.amount)} for {sName} · {fee?.title}</DialogDescription>
            <dl className="mt-5 w-full space-y-1 rounded-lg bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Transaction ID</dt><dd className="font-mono text-xs">{done.transactionId}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Receipt</dt><dd className="font-mono text-xs">{done.receiptNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Remaining on this fee</dt><dd className="font-semibold tabular">{inr(done.balanceAfter)}</dd></div>
            </dl>
            <DialogFooter className="w-full">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={() => downloadFile(`/payments/${done._id}/receipt`, `${done.receiptNumber}.pdf`).catch(() => toast.error('Could not download receipt'))}><Download />Download receipt</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>Enter what was received. Balances are re-checked on the server before saving.</DialogDescription>
            </DialogHeader>
            {!fee ? (
              <FeePicker onPick={(f) => { setFee(f); setValue('amount', paiseToRupeeInput(f.balance)); }} />
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{fee.title}</p>
                      <p className="text-xs text-muted-foreground">{sName} · Due {fmtDate(fee.dueDate)}</p>
                    </div>
                    <StatusBadge status={fee.effectiveStatus} />
                  </div>
                  {!initialFee && <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => setFee(null)}>Choose a different fee</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Amount received" htmlFor="amount" error={errors.amount?.message} required>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                      <Input id="amount" inputMode="decimal" autoComplete="off" className="pl-7 pr-14" {...register('amount')} aria-invalid={!!errors.amount} />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary-soft" onClick={() => setValue('amount', paiseToRupeeInput(fee.balance))}>Full</button>
                    </div>
                  </Field>
                  <Field label="Payment date" htmlFor="paidAt" error={errors.paidAt?.message} required>
                    <Input id="paidAt" type="date" max={isoDay()} {...register('paidAt')} />
                  </Field>
                </div>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-slate-700">Payment method<span className="text-destructive"> *</span></legend>
                  <Controller control={control} name="method" render={({ field }) => (
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
                      {METHODS.map((m) => {
                        const on = field.value === m.value;
                        return (
                          <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => field.onChange(m.value)}
                            className={cn('flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors sm:p-3', on ? 'border-primary bg-primary-soft/60 ring-1 ring-primary' : 'hover:bg-muted/60')}>
                            <m.icon className={cn('h-4 w-4', on ? 'text-primary' : 'text-slate-500')} />
                            <span className="text-[13px] font-medium leading-tight sm:text-sm">{m.label}</span>
                            <span className="text-[11px] text-muted-foreground">{m.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  )} />
                </fieldset>
                <Field label={method === 'cash' ? 'Reference (optional)' : 'Transaction reference / UTR'} htmlFor="reference" error={errors.reference?.message} required={method !== 'cash'}
                  hint={method === 'cash' ? 'e.g. cash book entry number' : 'As shown in the bank statement or UPI app.'}>
                  <Input id="reference" className="font-mono" placeholder={method === 'cash' ? 'Optional' : 'e.g. 412398765432'} {...register('reference')} aria-invalid={!!errors.reference} />
                </Field>
                {method === 'online_manual' && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    There is no payment gateway. Only record online payments you have verified in the institute's bank statement. The receipt will say it was a manual entry.
                  </p>
                )}
                <div className="rounded-lg bg-muted/70 p-3.5 text-sm">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Balance preview</p>
                  <dl className="space-y-1.5">
                    <div className="flex justify-between"><dt className="text-slate-600">Fee total</dt><dd className="tabular">{inr(fee.amount)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-600">Paid before</dt><dd className="tabular">{inr(fee.amountPaid)}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-600">This payment</dt><dd className="tabular">– {inr(amountPaise ?? 0)}</dd></div>
                    <div className="mt-1 flex justify-between border-t pt-2 font-medium"><dt>Remaining after</dt>
                      <dd className={cn('text-base font-semibold tabular', remaining !== null && remaining < 0 && 'text-red-600')}>{remaining === null ? '—' : remaining < 0 ? `Exceeds by ${inr(-remaining)}` : inr(remaining)}</dd></div>
                  </dl>
                  <ProgressBar className="mt-3" value={((fee.amountPaid + Math.max(0, amountPaise ?? 0)) / fee.amount) * 100} />
                </div>
                <Field label="Notes (optional)" htmlFor="notes"><Textarea id="notes" rows={2} placeholder="e.g. Paid at the front desk" {...register('notes')} /></Field>
                {serverError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button type="submit" loading={isSubmitting} disabled={fee.balance <= 0}>Record {amountPaise ? inr(amountPaise) : 'payment'}</Button>
                </DialogFooter>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
