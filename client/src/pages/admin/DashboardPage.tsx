import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, BellRing, CalendarPlus, CircleDollarSign, Clock, GraduationCap, Plus, Receipt, TrendingUp, UserPlus, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, ErrorState, PageHeader, StatCard } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { CollectionChart, Legend, SERIES } from '@/components/charts';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { StudentFormDialog } from '@/features/students/StudentFormDialog';
import { GenerateFeesDialog } from '@/features/fees/FeeDialogs';
import { MethodBadge } from '@/features/payments/PaymentList';
import { useApi } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { useAppSelector } from '@/store';
import { fmtDate, inr, relativeDays } from '@/utils/format';
import type { MonthlyPoint, Payment } from '@/types';

interface Dashboard {
  stats: { totalStudents: number; activeStudents: number; totalCollected: number; totalBilled: number; pendingAmount: number; overdueAmount: number; overdueCount: number; collectedThisMonth: number; paymentsThisMonth: number; collectionRate: number };
  monthly: MonthlyPoint[];
  recentPayments: Payment[];
  outstandingStudents: { _id: string; outstanding: number; overdue: number; oldestDue: string; count: number; student: { _id: string; fullName: string; studentId: string; course: string; batch: string } }[];
}

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const { data, loading, error, reload } = useApi<Dashboard>('/reports/dashboard');
  const [pay, setPay] = useState(false);
  const [addStudent, setAddStudent] = useState(false);
  const [gen, setGen] = useState(false);
  const [reminding, setReminding] = useState(false);
  const navigate = useNavigate();
  const s = data?.stats;

  const sendReminders = async () => {
    setReminding(true);
    try {
      const { data: r } = await api.post('/notifications/reminders/run');
      toast.success(r.data.inserted ? `${r.data.inserted} reminders sent` : 'Everyone is already up to date', { description: `${r.data.overdue} overdue · ${r.data.dueSoon} due soon` });
    } catch (e) { toast.error(errMsg(e)); } finally { setReminding(false); }
  };

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  const hour = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        description="Here's how fee collection is tracking today."
        actions={<>
          <Button variant="outline" onClick={() => setGen(true)}><CalendarPlus />Generate fees</Button>
          <Button onClick={() => setPay(true)}><Plus />Record payment</Button>
        </>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total students" value={s?.totalStudents} hint={s && `${s.activeStudents} active`} icon={GraduationCap} loading={loading && !s} />
        <StatCard label="Collected" value={s && inr(s.totalCollected, { compact: true })} hint={s && `${s.collectionRate}% of billed · ${inr(s.collectedThisMonth, { compact: true })} this month`} icon={CircleDollarSign} tone="emerald" loading={loading && !s} />
        <StatCard label="Pending" value={s && inr(s.pendingAmount, { compact: true })} hint="All outstanding balances" icon={Clock} tone="amber" loading={loading && !s} />
        <StatCard label="Overdue" value={s && inr(s.overdueAmount, { compact: true })} hint={s && `${s.overdueCount} fee${s.overdueCount === 1 ? '' : 's'} past due`} icon={AlertCircle} tone="red" loading={loading && !s} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Monthly collection</CardTitle><CardDescription>Billed vs collected, last 6 months</CardDescription></div>
            <Legend items={[{ label: 'Billed', color: SERIES.ref }, { label: 'Collected', color: SERIES.s1 }]} />
          </CardHeader>
          <CardContent>{data ? <CollectionChart data={data.monthly} /> : <Skeleton className="h-[260px] w-full" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Common tasks</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {[
              { icon: Receipt, label: 'Record a payment', onClick: () => setPay(true) },
              { icon: UserPlus, label: 'Add a student', onClick: () => setAddStudent(true) },
              { icon: CalendarPlus, label: 'Generate monthly fees', onClick: () => setGen(true) },
              { icon: BellRing, label: reminding ? 'Sending reminders…' : 'Send fee reminders', onClick: sendReminders, disabled: reminding },
              { icon: TrendingUp, label: 'View reports', onClick: () => navigate('/admin/reports') },
            ].map((a) => (
              <button key={a.label} onClick={a.onClick} disabled={a.disabled} className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 disabled:opacity-60">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-primary"><a.icon className="h-4 w-4" /></span>
                {a.label}<ArrowRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-primary" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Students with outstanding fees</CardTitle><CardDescription>Sorted by overdue amount</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/students?feeStatus=outstanding">View all</Link></Button></CardHeader>
          <CardContent className="px-0 pb-2">
            {!data ? <div className="space-y-3 px-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div> :
              data.outstandingStudents.length === 0 ? <EmptyState icon={Wallet} title="All clear" description="No student has outstanding fees." /> : (
                <ul className="divide-y">
                  {data.outstandingStudents.map((o) => (
                    <li key={o._id}>
                      <Link to={`/admin/students/${o.student._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <Avatar name={o.student.fullName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{o.student.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{o.student.course} · {o.count} unpaid fee{o.count > 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular">{inr(o.outstanding)}</p>
                          {o.overdue > 0 ? <p className="text-xs text-red-600 tabular">{inr(o.overdue)} overdue</p> : <p className="text-xs text-muted-foreground">Due {relativeDays(o.oldestDue)}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent payments</CardTitle><CardDescription>Latest recorded transactions</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/payments">View all</Link></Button></CardHeader>
          <CardContent className="px-0 pb-2">
            {!data ? <div className="space-y-3 px-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div> :
              data.recentPayments.length === 0 ? <EmptyState icon={Receipt} title="No payments yet" /> : (
                <ul className="divide-y">
                  {data.recentPayments.map((p) => {
                    const st = typeof p.student === 'object' ? p.student : null;
                    const f = typeof p.feeRecord === 'object' ? p.feeRecord : null;
                    return (
                      <li key={p._id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar name={st?.fullName ?? '?'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{st?.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{f?.title}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-sm font-semibold tabular text-emerald-700">+{inr(p.amount)}</p>
                          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">{fmtDate(p.paidAt)}<MethodBadge method={p.method} /></div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </CardContent>
        </Card>
      </div>
      <RecordPaymentDialog open={pay} onOpenChange={setPay} onRecorded={reload} />
      <StudentFormDialog open={addStudent} onOpenChange={setAddStudent} onSaved={(st) => navigate(`/admin/students/${st._id}`)} />
      <GenerateFeesDialog open={gen} onOpenChange={setGen} onDone={reload} />
    </>
  );
}
