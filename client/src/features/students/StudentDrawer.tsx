import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowUpRight, Pencil, Receipt, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, ErrorState, ProgressBar, StatusBadge } from '@/components/common';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { StudentFormDialog } from './StudentFormDialog';
import { useApi } from '@/hooks/useApi';
import { fmtDate, inr } from '@/utils/format';
import type { FeeRecord, FeeSummary, Payment, Student } from '@/types';

interface Detail { student: Student; summary: FeeSummary; fees: FeeRecord[]; payments: Payment[] }

/** Right-hand quick view of a student: balance, unpaid fees and key details. */
export function StudentDrawer({ studentId, onOpenChange, onChanged }: { studentId: string | null; onOpenChange: (o: boolean) => void; onChanged?: () => void }) {
  const { data, error, reload } = useApi<Detail>(studentId ? `/students/${studentId}` : null);
  const [pay, setPay] = useState<FeeRecord | null>(null);
  const [edit, setEdit] = useState(false);
  const d = data && data.student._id === studentId ? data : null;
  const unpaid = d ? d.fees.filter((f) => f.balance > 0 && f.status !== 'cancelled').sort((a, b) => +new Date(b.dueDate) - +new Date(a.dueDate)) : [];
  const oldest = [...unpaid].sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0] ?? null;
  const status = d ? (d.summary.totalOverdue > 0 ? 'overdue' : d.summary.totalPending > 0 ? 'pending' : 'paid') : null;
  const refresh = () => { void reload(); onChanged?.(); };

  return (
    <>
      <DialogPrimitive.Root open={!!studentId} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/30 data-[state=open]:animate-in" />
          <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col bg-white shadow-2xl focus:outline-none data-[state=open]:animate-slide-in">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div className="min-w-0">
                <DialogPrimitive.Title className="truncate text-base font-semibold">{d?.student.fullName ?? 'Student'}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[13px] text-muted-foreground">{d ? `${d.student.studentId} · ${d.student.course}` : 'Loading…'}</DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="rounded-md p-1 text-slate-400 hover:bg-muted hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {error && !d ? <ErrorState message={error} onRetry={reload} /> : !d ? (
                <div className="space-y-4"><Skeleton className="h-14" /><Skeleton className="h-28" /><Skeleton className="h-48" /></div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={d.student.fullName} className="h-12 w-12 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{d.student.fullName}</p>
                      <div className="mt-1 flex items-center gap-2">{status && <StatusBadge status={status} />}{d.student.status === 'inactive' && <Badge variant="neutral">Inactive</Badge>}</div>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border bg-[#fafbfd] p-4">
                    <p className="text-[13px] text-muted-foreground">Outstanding</p>
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-2xl font-semibold tabular">{inr(d.summary.totalPending)}</p>
                      {d.summary.totalOverdue > 0 && <p className="text-[13px] font-medium tabular text-red-600">{inr(d.summary.totalOverdue)} overdue</p>}
                    </div>
                    <ProgressBar className="mt-3" value={d.summary.totalFees ? (d.summary.totalPaid / d.summary.totalFees) * 100 : 0} />
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Paid <span className="font-medium text-foreground tabular">{inr(d.summary.totalPaid)}</span></span><span className="tabular">of {inr(d.summary.totalFees)}</span></div>
                  </div>

                  <p className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unpaid fees</p>
                  {unpaid.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No unpaid fees.</p> : (
                    <ul className="divide-y rounded-xl border">
                      {unpaid.map((f) => (
                        <li key={f._id}>
                          <button onClick={() => setPay(f)} className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left hover:bg-[#fafbfd]" aria-label={`Record payment for ${f.title}`}>
                            <span className="min-w-0"><span className="block truncate text-sm">{f.title}</span><span className="text-xs text-muted-foreground">Due {fmtDate(f.dueDate)}{f.amountPaid > 0 && ` · ${inr(f.amountPaid)} paid`}</span></span>
                            <span className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-semibold tabular">{inr(f.balance)}</span><StatusBadge status={f.effectiveStatus} /></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mb-1 mt-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Details</p>
                  <dl className="divide-y text-sm">
                    <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Class</dt><dd className="text-right">{d.student.course}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Batch</dt><dd className="text-right">{d.student.batch}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Fee plan</dt><dd className="text-right">{d.student.feePlan?.name ?? '—'}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Parent</dt><dd className="text-right">{d.student.parent ? <>{d.student.parent.name}{d.student.parent.phone && <span className="block text-xs text-muted-foreground">{d.student.parent.phone}</span>}</> : <span className="text-slate-400">Not linked</span>}</dd></div>
                    <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">Phone</dt><dd className="text-right">{d.student.phone || '—'}</dd></div>
                  </dl>
                </>
              )}
            </div>
            {d && (
              <div className="flex items-center gap-2 border-t px-5 py-3">
                <Button variant="outline" onClick={() => setEdit(true)}><Pencil />Edit</Button>
                <Button variant="outline" asChild><Link to={`/admin/students/${d.student._id}`}>Full profile<ArrowUpRight /></Link></Button>
                <Button className="ml-auto" disabled={!oldest} onClick={() => setPay(oldest)}><Receipt />Record payment</Button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <RecordPaymentDialog open={!!pay} onOpenChange={(o) => !o && setPay(null)} fee={pay} studentName={d?.student.fullName} onRecorded={refresh} />
      <StudentFormDialog open={edit} onOpenChange={setEdit} student={d?.student} onSaved={refresh} />
    </>
  );
}
