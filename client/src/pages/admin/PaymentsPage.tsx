import { useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ErrorState, PageHeader, Pagination, SearchInput } from '@/components/common';
import { PaymentList } from '@/features/payments/PaymentList';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { useApi, useDebounced } from '@/hooks/useApi';
import { downloadFile } from '@/services/api';
import { inr } from '@/utils/format';
import type { Payment } from '@/types';

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [method, setMethod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  useEffect(() => setPage(1), [q, method, from, to]);
  const { data, meta, loading, error, reload } = useApi<Payment[]>('/payments', { search: q, method, from, to, page, limit: 20 });
  const exportCsv = () => {
    const p = new URLSearchParams({ type: 'payments' });
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    downloadFile(`/reports/export?${p}`, 'payments.csv').catch(() => toast.error('Export failed'));
  };
  return (
    <>
      <PageHeader title="Payments" description={meta ? <>{meta.total} payments · <span className="font-medium text-slate-700">{inr(meta.totalAmount as number)}</span> total{from || to || method !== 'all' || q ? ' (filtered)' : ''}</> : 'All recorded transactions'}
        actions={<><Button variant="outline" onClick={exportCsv}><Download />Export CSV</Button><Button onClick={() => setOpen(true)}><Plus />Record payment</Button></>} />
      <Card>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-3 lg:grid-cols-[1fr_200px_150px_150px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student, transaction ID, receipt or UTR" className="sm:col-span-3 lg:col-span-1" />
          <Select aria-label="Method" value={method} onValueChange={setMethod} options={[{ value: 'all', label: 'All methods' }, { value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'online_manual', label: 'Online (manual entry)' }]} />
          <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : <PaymentList items={data} loading={loading} />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">All payments are recorded manually by staff. “Online (manual entry)” payments were not processed through a payment gateway.</p>
      <RecordPaymentDialog open={open} onOpenChange={setOpen} onRecorded={reload} />
    </>
  );
}
