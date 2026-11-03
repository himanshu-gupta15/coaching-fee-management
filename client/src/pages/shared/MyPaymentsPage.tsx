import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ErrorState, PageHeader, Pagination } from '@/components/common';
import { PaymentList } from '@/features/payments/PaymentList';
import { useApi } from '@/hooks/useApi';
import { useAppSelector } from '@/store';
import { inr } from '@/utils/format';
import type { Payment } from '@/types';

export default function MyPaymentsPage() {
  const role = useAppSelector((s) => s.auth.user!.role);
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi<Payment[]>('/payments', { page, limit: 20 });
  return (
    <>
      <PageHeader title="Payment history" description={meta ? `${meta.total} payments · ${inr(meta.totalAmount as number)} paid in total` : 'All payments and receipts'} />
      <Card>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : <PaymentList items={data} loading={loading} showStudent={role === 'parent'} />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Payments are recorded by the institute office. Download a PDF receipt for any payment using the receipt button.</p>
    </>
  );
}
