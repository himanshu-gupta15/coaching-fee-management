import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { Avatar, EmptyState, ProgressBar, StatusBadge, TableSkeleton } from '@/components/common';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { fmtDate, inr } from '@/utils/format';
import type { FeeRecord } from '@/types';

const stu = (f: FeeRecord) => (typeof f.student === 'object' ? f.student : null);

/** "NEET UG (Monthly) — November 2026" → ["NEET UG (Monthly)", "Nov 2026"] */
export function splitTitle(title: string): [string, string | null] {
  const i = title.lastIndexOf(' — ');
  if (i < 0) return [title, null];
  const period = title.slice(i + 3).replace(/^(January|February|March|April|May|June|July|August|September|October|November|December)/, (m) => m.slice(0, 3));
  return [title.slice(0, i), period];
}

function DueCell({ f }: { f: FeeRecord }) {
  return (
    <div className="whitespace-nowrap">
      <p>{fmtDate(f.dueDate)}</p>
      {f.effectiveStatus === 'paid' && f.paidAt && <p className="text-xs text-muted-foreground">Paid {fmtDate(f.paidAt).replace(/ \d{4}$/, '')}</p>}
      {f.daysOverdue > 0 && <p className="text-xs text-red-600">{f.daysOverdue} days overdue</p>}
    </div>
  );
}

/** Fee records as a table on desktop and cards on mobile. `actions` renders per-row controls. */
export function FeeList({ items, loading, showStudent = true, actions, emptyText = 'No fee records match.' }: {
  items: FeeRecord[] | null; loading?: boolean; showStudent?: boolean; actions?: (f: FeeRecord) => ReactNode; emptyText?: string;
}) {
  if (loading && !items) return <TableSkeleton />;
  if (!items?.length) return <EmptyState icon={Wallet} title="No fees" description={emptyText} />;
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead><TR>{showStudent && <TH>Student</TH>}<TH>Fee &amp; period</TH><TH>Due date</TH><TH className="text-right">Total</TH><TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH>Status</TH>{actions && <TH><span className="sr-only">Actions</span></TH>}</TR></THead>
          <TBody className={loading ? 'opacity-60' : ''}>
            {items.map((f) => {
              const s = stu(f);
              const [plan, period] = splitTitle(f.title);
              const partial = f.amountPaid > 0 && f.amountPaid < f.amount;
              return (
                <TR key={f._id}>
                  {showStudent && (
                    <TD><div className="flex items-center gap-3"><Avatar name={s?.fullName ?? '?'} className="h-8 w-8" /><div className="min-w-0"><p className="max-w-[170px] truncate font-medium">{s?.fullName}</p><p className="font-mono text-[11px] text-muted-foreground">{s?.studentId}</p></div></div></TD>
                  )}
                  <TD className="min-w-[180px] max-w-[260px]"><p className="truncate" title={f.title}>{plan}</p>{period && <p className="text-xs text-muted-foreground">{period}</p>}</TD>
                  <TD><DueCell f={f} /></TD>
                  <TD className="text-right tabular text-slate-600">{inr(f.amount)}</TD>
                  <TD className="text-right tabular">
                    <span className={cn(f.amountPaid > 0 ? 'font-medium' : 'text-slate-500')}>{inr(f.amountPaid)}</span>
                    {partial && <ProgressBar value={(f.amountPaid / f.amount) * 100} className="ml-auto mt-1 h-1 w-16" />}
                  </TD>
                  <TD className={cn('text-right font-semibold tabular', f.effectiveStatus === 'overdue' && 'text-red-600')}>{f.balance > 0 ? inr(f.balance) : <span className="font-normal text-slate-400">—</span>}</TD>
                  <TD><StatusBadge status={f.effectiveStatus} /></TD>
                  {actions && <TD className="text-right whitespace-nowrap">{actions(f)}</TD>}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {items.map((f) => {
          const s = stu(f);
          return (
            <li key={f._id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showStudent && <p className="text-sm font-medium">{s?.fullName}</p>}
                  <p className="text-sm text-slate-700">{f.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Due {fmtDate(f.dueDate)}{f.daysOverdue > 0 && <span className="text-red-600"> · {f.daysOverdue} days overdue</span>}</p>
                </div>
                <StatusBadge status={f.effectiveStatus} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <ProgressBar value={(f.amountPaid / f.amount) * 100} className="flex-1" />
                <span className="text-xs tabular text-muted-foreground">{inr(f.amountPaid)} / {inr(f.amount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm">Balance <span className="font-semibold tabular">{inr(f.balance)}</span></span>
                {actions && <div className="flex gap-1">{actions(f)}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
