import { AlertCircle, CircleDollarSign, Clock, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, KV, StatCard } from '@/components/common';
import { FeeList } from '@/features/fees/FeeList';
import { PaymentList } from '@/features/payments/PaymentList';
import { fmtDate, inr } from '@/utils/format';
import type { FeeRecord, FeeSummary, Payment, Student } from '@/types';

export interface StudentDetail { student: Student; summary: FeeSummary; fees: FeeRecord[]; payments: Payment[] }

/** Read-only fee view used by parent (child page) and student (home). */
export function StudentFeeView({ data }: { data: StudentDetail }) {
  const { student: s, summary, fees, payments } = data;
  const active = fees.filter((f) => f.status !== 'cancelled');
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <Avatar name={s.fullName} className="h-14 w-14 text-base" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{s.fullName}</h1>
            <p className="text-sm text-muted-foreground">{s.course} · {s.batch}</p>
            <p className="font-mono text-xs text-muted-foreground">{s.studentId}</p>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total fees" value={inr(summary.totalFees)} icon={Wallet} tone="slate" />
        <StatCard label="Paid" value={inr(summary.totalPaid)} icon={CircleDollarSign} tone="emerald" />
        <StatCard label="Due" value={inr(summary.totalPending)} hint={summary.nextDue ? `Next: ${fmtDate(summary.nextDue.dueDate)}` : undefined} icon={Clock} tone="amber" />
        <StatCard label="Overdue" value={inr(summary.totalOverdue)} icon={AlertCircle} tone="red" />
      </div>
      <Card>
        <Tabs defaultValue="fees">
          <div className="border-b p-3"><TabsList><TabsTrigger value="fees">Fee breakdown</TabsTrigger><TabsTrigger value="payments">Payment history</TabsTrigger></TabsList></div>
          <TabsContent value="fees"><FeeList items={active} showStudent={false} emptyText="No fees have been added yet." /></TabsContent>
          <TabsContent value="payments"><PaymentList items={payments} showStudent={false} /></TabsContent>
        </Tabs>
      </Card>
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent><dl className="divide-y"><KV label="Email"><span className="break-all">{s.email}</span></KV><KV label="Phone">{s.phone || '—'}</KV><KV label="Admission date">{fmtDate(s.admissionDate)}</KV><KV label="Fee plan">{s.feePlan?.name ?? '—'}</KV>{s.parent && <KV label="Parent">{s.parent.name}</KV>}</dl></CardContent>
      </Card>
    </div>
  );
}
