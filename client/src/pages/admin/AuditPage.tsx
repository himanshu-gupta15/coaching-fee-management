import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { fmtDateTime } from '@/utils/format';

interface Log { _id: string; action: string; summary: string; actorRole: string; actor?: { name: string; email: string } | null; createdAt: string; ip?: string }

const VARIANT = (a: string) => (a.startsWith('payment') ? 'success' : a.includes('failed') || a.includes('archived') || a.includes('cancel') || a.includes('disabled') ? 'danger' : a.startsWith('auth') ? 'neutral' : 'info');

export default function AuditPage() {
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [action]);
  const { data, meta, loading, error, reload } = useApi<Log[]>('/reports/audit-logs', { action, page, limit: 25 });
  return (
    <>
      <PageHeader title="Audit log" description="Every financial and administrative change, with who made it and when" />
      <Card>
        <div className="border-b p-3">
          <Select aria-label="Action type" className="sm:w-56" value={action} onValueChange={setAction} options={[
            { value: 'all', label: 'All activity' }, { value: 'payment', label: 'Payments' }, { value: 'fee', label: 'Fees & plans' }, { value: 'student', label: 'Students' },
            { value: 'parent', label: 'Parents' }, { value: 'auth', label: 'Sign-ins & passwords' }, { value: 'announcement', label: 'Announcements' }, { value: 'user', label: 'Accounts' },
          ]} />
        </div>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={10} /> : !data?.length ? <EmptyState icon={ScrollText} title="No activity" /> : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead><TR><TH>When</TH><TH>Who</TH><TH>Action</TH><TH>Details</TH></TR></THead>
                <TBody>
                  {data.map((l) => (
                    <TR key={l._id}>
                      <TD className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(l.createdAt)}</TD>
                      <TD className="whitespace-nowrap">{l.actor?.name ?? <span className="capitalize text-slate-500">{l.actorRole}</span>}</TD>
                      <TD><Badge variant={VARIANT(l.action)}>{l.action}</Badge></TD>
                      <TD className="text-slate-700">{l.summary}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {data.map((l) => (
                <li key={l._id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2"><Badge variant={VARIANT(l.action)}>{l.action}</Badge><span className="text-xs text-muted-foreground">{fmtDateTime(l.createdAt)}</span></div>
                  <p className="mt-1.5 text-sm">{l.summary}</p>
                  <p className="text-xs text-muted-foreground">{l.actor?.name ?? l.actorRole}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
