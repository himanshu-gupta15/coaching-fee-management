import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, CircleDollarSign, Clock, Download, FileBarChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader, StatCard, StatusBadge, TableSkeleton } from '@/components/common';
import { CollectionChart, Legend, MethodChart, SERIES } from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { downloadFile } from '@/services/api';
import { fmtDate, inr, isoDay } from '@/utils/format';
import type { FeeRecord, MonthlyPoint } from '@/types';

interface Collections { total: number; monthly: MonthlyPoint[]; byCourse: { _id: string; total: number; count: number }[] }
interface Outstanding { items: (FeeRecord & { student: { _id: string; fullName: string; studentId: string; course: string; parent?: { name: string; phone?: string } } })[]; total: number; count: number }

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 5, 1);
  return isoDay(d).slice(0, 8) + '01';
}

function OutstandingTable({ data, loading }: { data: Outstanding | null; loading: boolean }) {
  if (loading && !data) return <TableSkeleton />;
  if (!data?.items.length) return <EmptyState icon={FileBarChart} title="Nothing outstanding" description="No fees match this report for the selected period." />;
  return (
    <Table>
      <THead><TR><TH>Student</TH><TH>Parent contact</TH><TH>Fee</TH><TH>Due</TH><TH className="text-right">Balance</TH><TH>Status</TH></TR></THead>
      <TBody>
        {data.items.map((f) => (
          <TR key={f._id}>
            <TD><Link to={`/admin/students/${f.student?._id}`} className="font-medium hover:text-primary">{f.student?.fullName}</Link><p className="text-xs text-muted-foreground">{f.student?.studentId}</p></TD>
            <TD className="text-sm text-slate-600">{f.student?.parent?.name ?? '—'}{f.student?.parent?.phone && <a href={`tel:${f.student.parent.phone}`} className="block text-xs hover:underline">{f.student.parent.phone}</a>}</TD>
            <TD className="max-w-[240px] truncate">{f.title}</TD>
            <TD className="whitespace-nowrap">{fmtDate(f.dueDate)}{f.daysOverdue > 0 && <span className="block text-xs text-red-600">{f.daysOverdue}d overdue</span>}</TD>
            <TD className="text-right font-semibold tabular">{inr(f.balance)}</TD>
            <TD><StatusBadge status={f.effectiveStatus} /></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default function ReportsPage() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(isoDay());
  const range = { from, to };
  const coll = useApi<Collections>('/reports/collections', range);
  const pending = useApi<Outstanding>('/reports/pending', {});
  const overdue = useApi<Outstanding>('/reports/overdue', {});
  const exp = (type: string, withRange = true) => {
    const p = new URLSearchParams({ type });
    if (withRange) { if (from) p.set('from', from); if (to) p.set('to', to); }
    downloadFile(`/reports/export?${p}`, `${type}.csv`).then(() => toast.success('CSV downloaded')).catch(() => toast.error('Export failed'));
  };
  const billed = coll.data?.monthly.reduce((a, m) => a + m.billed, 0) ?? 0;

  return (
    <>
      <PageHeader title="Reports" description="Collection trends, pending and overdue fees"
        actions={<div className="flex flex-wrap items-center gap-2">
          <Input type="date" aria-label="From" className="w-[150px]" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" aria-label="To" className="w-[150px]" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Collected in period" value={coll.data && inr(coll.data.total, { compact: true })} icon={CircleDollarSign} tone="emerald" loading={!coll.data} />
        <StatCard label="Billed in period" value={coll.data && inr(billed, { compact: true })} hint={coll.data && billed ? `${Math.round((coll.data.total / billed) * 100)}% collected` : undefined} icon={FileBarChart} tone="indigo" loading={!coll.data} />
        <StatCard label="Total pending" value={pending.data && inr(pending.data.total, { compact: true })} hint={pending.data && `${pending.data.count} unpaid fees`} icon={Clock} tone="amber" loading={!pending.data} />
        <StatCard label="Total overdue" value={overdue.data && inr(overdue.data.total, { compact: true })} hint={overdue.data && `${overdue.data.count} fees past due`} icon={AlertCircle} tone="red" loading={!overdue.data} />
      </div>

      {coll.error && !coll.data ? <ErrorState message={coll.error} onRetry={coll.reload} /> : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Collection trend</CardTitle><CardDescription>Billed vs collected per month</CardDescription></div><Legend items={[{ label: 'Billed', color: SERIES.ref }, { label: 'Collected', color: SERIES.s1 }]} /></CardHeader>
            <CardContent>{coll.data ? <CollectionChart data={coll.data.monthly} /> : <Skeleton className="h-[260px]" />}</CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>By payment method</CardTitle><CardDescription>Collected per month</CardDescription></div><Legend items={[{ label: 'Cash', color: SERIES.s1 }, { label: 'Bank', color: SERIES.s2 }, { label: 'Online (manual)', color: SERIES.s3 }]} /></CardHeader>
            <CardContent>{coll.data ? <MethodChart data={coll.data.monthly} /> : <Skeleton className="h-[260px]" />}</CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <Tabs defaultValue="monthly">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList><TabsTrigger value="monthly">Monthly</TabsTrigger><TabsTrigger value="course">By course</TabsTrigger><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="overdue">Overdue</TabsTrigger></TabsList>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => exp('collections')}><Download />Collections CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exp('payments')}><Download />Payments CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exp('pending', false)}><Download />Pending CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exp('overdue', false)}><Download />Overdue CSV</Button>
            </div>
          </div>
          <TabsContent value="monthly">
            {!coll.data ? <TableSkeleton /> : (
              <Table>
                <THead><TR><TH>Month</TH><TH className="text-right">Billed</TH><TH className="text-right">Collected</TH><TH className="text-right">Payments</TH><TH className="text-right">Cash</TH><TH className="text-right">Bank</TH><TH className="text-right">Online (manual)</TH></TR></THead>
                <TBody>
                  {coll.data.monthly.map((m) => (
                    <TR key={m.month}><TD className="font-medium">{m.label}</TD><TD className="text-right tabular">{inr(m.billed)}</TD><TD className="text-right font-semibold tabular">{inr(m.collected)}</TD><TD className="text-right tabular">{m.count}</TD><TD className="text-right tabular">{inr(m.cash)}</TD><TD className="text-right tabular">{inr(m.bank)}</TD><TD className="text-right tabular">{inr(m.online)}</TD></TR>
                  ))}
                </TBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="course">
            {!coll.data ? <TableSkeleton /> : !coll.data.byCourse.length ? <EmptyState icon={FileBarChart} title="No collections in this period" /> : (
              <Table>
                <THead><TR><TH>Course</TH><TH className="text-right">Payments</TH><TH className="text-right">Collected</TH></TR></THead>
                <TBody>{coll.data.byCourse.map((c) => <TR key={c._id}><TD className="font-medium">{c._id}</TD><TD className="text-right tabular">{c.count}</TD><TD className="text-right font-semibold tabular">{inr(c.total)}</TD></TR>)}</TBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="pending"><OutstandingTable data={pending.data} loading={pending.loading} /></TabsContent>
          <TabsContent value="overdue"><OutstandingTable data={overdue.data} loading={overdue.loading} /></TabsContent>
        </Tabs>
      </Card>
    </>
  );
}
