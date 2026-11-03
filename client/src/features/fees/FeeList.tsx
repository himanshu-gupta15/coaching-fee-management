import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { EmptyState, ProgressBar, StatusBadge, TableSkeleton } from '@/components/common';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { fmtDate, inr } from '@/utils/format';
import type { FeeRecord } from '@/types';

const sName = (f: FeeRecord) => (typeof f.student === 'object' ? f.student.fullName : '');

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
          <THead><TR>{showStudent && <TH>Student</TH>}<TH>Fee</TH><TH>Due date</TH><TH className="text-right">Amount</TH><TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH>Status</TH>{actions && <TH className="text-right">Actions</TH>}</TR></THead>
          <TBody>
            {items.map((f) => (
              <TR key={f._id}>
                {showStudent && <TD className="font-medium whitespace-nowrap">{sName(f)}</TD>}
                <TD className="min-w-[180px] max-w-[300px]"><p className="line-clamp-2" title={f.title}>{f.title}</p></TD>
                <TD className="whitespace-nowrap text-slate-600">{fmtDate(f.dueDate)}{f.daysOverdue > 0 && <span className="block text-xs text-red-600">{f.daysOverdue} days overdue</span>}</TD>
                <TD className="text-right tabular">{inr(f.amount)}</TD>
                <TD className="text-right tabular text-slate-600">{inr(f.amountPaid)}</TD>
                <TD className="text-right font-semibold tabular">{inr(f.balance)}</TD>
                <TD><StatusBadge status={f.effectiveStatus} /></TD>
                {actions && <TD className="text-right whitespace-nowrap">{actions(f)}</TD>}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {items.map((f) => (
          <li key={f._id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {showStudent && <p className="text-sm font-medium">{sName(f)}</p>}
                <p className="text-sm text-slate-700">{f.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Due {fmtDate(f.dueDate)}{f.daysOverdue > 0 && <span className="text-red-600"> · {f.daysOverdue} days overdue</span>}</p>
              </div>
              <StatusBadge status={f.effectiveStatus} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={(f.amountPaid / f.amount) * 100} className="flex-1" />
              <span className="text-xs tabular text-muted-foreground">{inr(f.amountPaid)} / {inr(f.amount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm">Balance <span className="font-semibold tabular">{inr(f.balance)}</span></span>
              {actions && <div className="flex gap-1">{actions(f)}</div>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
