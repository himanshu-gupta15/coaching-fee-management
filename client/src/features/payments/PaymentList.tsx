import { Download, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/common';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { downloadFile } from '@/services/api';
import { fmtDate, inr, METHOD_LABEL } from '@/utils/format';
import type { Payment } from '@/types';

export function downloadReceipt(p: Pick<Payment, '_id' | 'receiptNumber'>) {
  return downloadFile(`/payments/${p._id}/receipt`, `${p.receiptNumber}.pdf`)
    .then(() => toast.success('Receipt downloaded'))
    .catch(() => toast.error('Could not download the receipt. Please try again.'));
}

const sName = (p: Payment) => (typeof p.student === 'object' ? p.student.fullName : '');
const fTitle = (p: Payment) => (typeof p.feeRecord === 'object' ? p.feeRecord.title : '');

export function MethodBadge({ method }: { method: Payment['method'] }) {
  return <Badge variant={method === 'online_manual' ? 'warning' : method === 'cash' ? 'neutral' : 'info'} title={method === 'online_manual' ? 'Recorded manually, not verified by a payment gateway' : undefined}>{METHOD_LABEL[method]}</Badge>;
}

/** Payments as a table on desktop and stacked cards on mobile. */
export function PaymentList({ items, loading, showStudent = true, emptyText = 'No payments recorded yet.' }: { items: Payment[] | null; loading?: boolean; showStudent?: boolean; emptyText?: string }) {
  if (loading && !items) return <TableSkeleton />;
  if (!items?.length) return <EmptyState icon={Receipt} title="No payments" description={emptyText} />;
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead><TR><TH>Date</TH>{showStudent && <TH>Student</TH>}<TH>Fee</TH><TH>Method</TH><TH>Transaction</TH><TH className="text-right">Amount</TH><TH className="w-12"><span className="sr-only">Receipt</span></TH></TR></THead>
          <TBody>
            {items.map((p) => (
              <TR key={p._id}>
                <TD className="whitespace-nowrap text-slate-600">{fmtDate(p.paidAt)}</TD>
                {showStudent && <TD className="font-medium">{sName(p)}</TD>}
                <TD className="max-w-[260px] truncate text-slate-600">{fTitle(p)}</TD>
                <TD><MethodBadge method={p.method} /></TD>
                <TD className="font-mono text-xs text-slate-500">{p.transactionId}</TD>
                <TD className="text-right font-semibold tabular">{inr(p.amount)}</TD>
                <TD><Button variant="ghost" size="icon" onClick={() => downloadReceipt(p)} aria-label={`Download receipt ${p.receiptNumber}`}><Download /></Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {items.map((p) => (
          <li key={p._id} className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              {showStudent && <p className="text-sm font-medium">{sName(p)}</p>}
              <p className="truncate text-sm text-slate-600">{fTitle(p)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{fmtDate(p.paidAt)} <MethodBadge method={p.method} /></p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="font-semibold tabular">{inr(p.amount)}</span>
              <Button variant="outline" size="sm" onClick={() => downloadReceipt(p)}><Download />Receipt</Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
