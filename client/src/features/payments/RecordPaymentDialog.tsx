import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field, StatusBadge } from '@/components/common';
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
              <DialogDescription>Record a payment received at the office. Balances are verified on the server.</DialogDescription>
            </DialogHeader>
            {!fee ? (
              <FeePicker onPick={(f) => { setFee(f); setValue('amount', paiseToRupeeInput(f.balance)); }} />
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="rounded-lg border bg-slate-50/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{fee.title}</p>
                      <p className="text-xs text-muted-foreground">{sName} · Due {fmtDate(fee.dueDate)}</p>
                    </div>
                    <StatusBadge status={fee.effectiveStatus} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-muted-foreground">Fee</p><p className="font-semibold tabular text-sm">{inr(fee.amount)}</p></div>
                    <div><p className="text-muted-foreground">Paid</p><p className="font-semibold tabular text-sm">{inr(fee.amountPaid)}</p></div>
                    <div><p className="text-muted-foreground">Outstanding</p><p className="font-semibold tabular text-sm text-primary">{inr(fee.balance)}</p></div>
                  </div>
                  {!initialFee && <button type="button" className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => setFee(null)}>Choose a different fee</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Amount (₹)" htmlFor="amount" error={errors.amount?.message} required
                    hint={remaining !== null && remaining >= 0 ? (remaining === 0 ? 'Clears this fee in full' : `${inr(remaining)} will remain`) : undefined}>
                    <div className="flex gap-2">
                      <Input id="amount" inputMode="decimal" autoComplete="off" {...register('amount')} aria-invalid={!!errors.amount} />
                      <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setValue('amount', paiseToRupeeInput(fee.balance))}>Full</Button>
                    </div>
                  </Field>
                  <Field label="Payment date" htmlFor="paidAt" error={errors.paidAt?.message} required>
                    <Input id="paidAt" type="date" max={isoDay()} {...register('paidAt')} />
                  </Field>
                  <Field label="Method" htmlFor="method" required>
                    <Controller control={control} name="method" render={({ field }) => (
                      <Select id="method" value={field.value} onValueChange={field.onChange} options={[
                        { value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'online_manual', label: 'Online (UPI/card) — manual entry' },
                      ]} />
                    )} />
                  </Field>
                  <Field label={method === 'cash' ? 'Reference (optional)' : 'Reference / UTR'} htmlFor="reference" error={errors.reference?.message} required={method !== 'cash'}>
                    <Input id="reference" placeholder={method === 'cash' ? 'Cash book no.' : 'e.g. UTR123456789'} {...register('reference')} aria-invalid={!!errors.reference} />
                  </Field>
                </div>
                {method === 'online_manual' && (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    This system has no payment gateway. Only record online payments you have verified in the institute's bank statement. It will be labelled as a manual entry on the receipt.
                  </p>
                )}
                <Field label="Notes (optional)" htmlFor="notes"><Textarea id="notes" rows={2} {...register('notes')} /></Field>
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
