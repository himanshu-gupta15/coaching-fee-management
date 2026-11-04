import { useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, BellRing, CalendarPlus, Clock, FileBarChart, GraduationCap, IndianRupee, Plus, Receipt, UserPlus, Wallet } from 'lucide-react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Avatar, Dot, EmptyState, ErrorState, IconChip, PageHeader, SegmentedBar, StatCard } from '@/components/common';
import { CollectionAreaChart, SERIES } from '@/components/charts';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { StudentFormDialog } from '@/features/students/StudentFormDialog';
import { GenerateFeesDialog } from '@/features/fees/FeeDialogs';
import { useApi } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { useAppSelector } from '@/store';
import { fmtDate, inr, isoDay, METHOD_LABEL, relativeDays } from '@/utils/format';
import type { MonthlyPoint, Payment, PaymentMethod } from '@/types';

interface Dashboard {
  stats: { totalStudents: number; activeStudents: number; totalCollected: number; totalBilled: number; pendingAmount: number; overdueAmount: number; overdueCount: number; collectedThisMonth: number; paymentsThisMonth: number; collectionRate: number };
  monthly: MonthlyPoint[];
  recentPayments: Payment[];
  outstandingStudents: { _id: string; outstanding: number; overdue: number; oldestDue: string; count: number; student: { _id: string; fullName: string; studentId: string; course: string; batch: string } }[];
  methodSplit: { _id: PaymentMethod; total: number; count: number }[];
}

function rangeFrom(months: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (months - 1));
  return isoDay(d).slice(0, 8) + '01';
}

const METHOD_SHORT: Record<PaymentMethod, string> = { bank_transfer: 'Bank transfer', cash: 'Cash', online_manual: 'Online' };

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const { data, error, reload } = useApi<Dashboard>('/reports/dashboard');
  const [months, setMonths] = useState('6');
  const chart = useApi<{ monthly: MonthlyPoint[]; total: number }>('/reports/collections', { from: rangeFrom(Number(months)), to: isoDay() });
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
  const reloadAll = () => { void reload(); void chart.reload(); };

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  const now = new Date();
  const hour = Number(now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const notDue = s ? s.pendingAmount - s.overdueAmount : 0;
  const pct = (v: number) => (s?.totalBilled ? Math.round((v / s.totalBilled) * 100) : 0);
  const billedInRange = chart.data?.monthly.reduce((a, m) => a + m.billed, 0) ?? 0;
  const methods = [...(data?.methodSplit ?? [])].sort((a, b) => b.total - a.total);

  const quick: { icon: ComponentType<{ className?: string }>; title: string; sub: string; onClick: () => void; disabled?: boolean }[] = [
    { icon: Receipt, title: 'Record a payment', sub: 'Cash, bank or UPI', onClick: () => setPay(true) },
    { icon: UserPlus, title: 'Add a student', sub: 'Enrol and assign a plan', onClick: () => setAddStudent(true) },
    { icon: CalendarPlus, title: 'Generate fees', sub: "Create this month's dues", onClick: () => setGen(true) },
    { icon: BellRing, title: reminding ? 'Sending…' : 'Send reminders', sub: 'Notify parents with dues', onClick: sendReminders, disabled: reminding },
    { icon: FileBarChart, title: 'View reports', sub: 'Exports and trends', onClick: () => navigate('/admin/reports') },
  ];

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        description="Here's your institute's fee overview."
        actions={<>
          <Button variant="outline" onClick={() => setGen(true)}><CalendarPlus />Generate fees</Button>
          <Button onClick={() => setPay(true)}><Plus />Record payment</Button>
        </>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total fee collection" icon={IndianRupee} tone="emerald" loading={!s} info="All payments recorded to date"
          value={s && inr(s.totalCollected)} hint={s && <><span className="font-medium text-foreground">{s.collectionRate}%</span> of {inr(s.totalBilled, { compact: true })} billed</>}
          sub={s && `${inr(s.collectedThisMonth)} this month · ${s.paymentsThisMonth} payment${s.paymentsThisMonth === 1 ? '' : 's'}`} />
        <StatCard label="Pending fees" icon={Clock} tone="amber" loading={!s} info="Unpaid balances that are not yet past their due date"
          value={s && inr(notDue)} hint="Not yet past due date" sub={s && `${inr(s.pendingAmount)} outstanding in total`} />
        <StatCard label="Overdue fees" icon={AlertCircle} tone="red" loading={!s} info="Unpaid balances past their due date"
          value={s && inr(s.overdueAmount)} hint={s && `${s.overdueCount} fee${s.overdueCount === 1 ? '' : 's'} past due date`} link={{ to: '/admin/fees?status=overdue', label: 'Review overdue' }} />
        <StatCard label="Active students" icon={GraduationCap} tone="indigo" loading={!s}
          value={s?.activeStudents} hint={s && `${s.totalStudents} enrolled · ${s.totalStudents - s.activeStudents} inactive`} link={{ to: '/admin/students', label: 'View students' }} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle>Fee collection</CardTitle><CardDescription>Amount received each month against what was billed</CardDescription></div>
            <Select aria-label="Chart range" className="w-[150px]" value={months} onValueChange={setMonths} options={[{ value: '3', label: 'Last 3 months' }, { value: '6', label: 'Last 6 months' }, { value: '12', label: 'Last 12 months' }]} />
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-8">
              <div><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-semibold tabular">{chart.data ? inr(chart.data.total) : '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Billed</p><p className="text-xl font-semibold tabular">{chart.data ? inr(billedInRange) : '—'}</p></div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES.s1 }} />Collected</span>
              <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed border-[#9aa1b5]" />Billed</span>
            </div>
          </div>
          <div className="mt-4">{chart.data ? <CollectionAreaChart data={chart.data.monthly} /> : <Skeleton className="h-[260px] w-full" />}</div>
        </Card>

        <Card className="flex flex-col p-5">
          <CardTitle>Collection breakdown</CardTitle>
          <CardDescription>All active fee records to date</CardDescription>
          {!s ? <Skeleton className="mt-4 h-40" /> : (
            <>
              <p className="mt-4 flex items-baseline gap-2"><span className="text-[34px] font-semibold tabular tracking-tight">{s.collectionRate}%</span><span className="text-sm text-muted-foreground">collected</span></p>
              <p className="text-xs text-muted-foreground">of {inr(s.totalBilled)} billed</p>
              <SegmentedBar className="mt-4" parts={[
                { label: 'Paid', value: s.totalCollected, className: 'bg-emerald-500' },
                { label: 'Pending', value: notDue, className: 'bg-amber-400' },
                { label: 'Overdue', value: s.overdueAmount, className: 'bg-red-500' },
              ]} />
              <ul className="mt-4 divide-y text-sm">
                {[
                  { tone: 'success' as const, label: 'Paid', sub: 'Received', v: s.totalCollected },
                  { tone: 'warning' as const, label: 'Pending', sub: 'Not yet due', v: notDue },
                  { tone: 'danger' as const, label: 'Overdue', sub: `${s.overdueCount} fees`, v: s.overdueAmount },
                ].map((r) => (
                  <li key={r.label} className="flex items-center gap-2.5 py-2.5">
                    <Dot tone={r.tone} /><span className="font-medium">{r.label}</span><span className="text-xs text-muted-foreground">{r.sub}</span>
                    <span className="ml-auto font-semibold tabular">{inr(r.v)}</span><span className="w-10 text-right text-xs tabular text-muted-foreground">{pct(r.v)}%</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t pt-3">
                <p className="text-xs text-muted-foreground">Received by method</p>
                <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {methods.length === 0 ? <span className="text-muted-foreground">No payments yet</span> : methods.map((m) => <span key={m._id}>{METHOD_SHORT[m._id]} <span className="font-semibold tabular">{inr(m.total, { compact: true })}</span></span>)}
                </p>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-5 pb-4">
            <div><CardTitle>Recent payments</CardTitle><CardDescription>Latest transactions recorded by staff</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/payments">View all<ArrowRight /></Link></Button>
          </div>
          {!data ? <div className="space-y-3 px-5 pb-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div> :
            data.recentPayments.length === 0 ? <EmptyState icon={Receipt} title="No payments yet" /> : (
              <>
                <div className="hidden sm:block">
                  <Table>
                    <THead><TR><TH>Student</TH><TH>Fee</TH><TH>Method</TH><TH className="text-right">Amount</TH><TH>Date</TH></TR></THead>
                    <TBody>
                      {data.recentPayments.map((p) => {
                        const st = typeof p.student === 'object' ? p.student : null;
                        const f = typeof p.feeRecord === 'object' ? p.feeRecord : null;
                        return (
                          <TR key={p._id}>
                            <TD><div className="flex items-center gap-3"><Avatar name={st?.fullName ?? '?'} className="h-8 w-8" /><div className="min-w-0"><p className="truncate font-medium">{st?.fullName}</p><p className="font-mono text-[11px] text-muted-foreground">{st?.studentId}</p></div></div></TD>
                            <TD className="max-w-[200px]"><p className="truncate text-slate-600" title={f?.title}>{f?.title}</p></TD>
                            <TD><Badge variant="outline">{p.method === 'online_manual' ? 'Online · manual' : METHOD_LABEL[p.method]}</Badge></TD>
                            <TD className="text-right font-semibold tabular">{inr(p.amount)}</TD>
                            <TD className="whitespace-nowrap text-slate-600">{fmtDate(p.paidAt)}</TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>
                <ul className="divide-y border-t sm:hidden">
                  {data.recentPayments.map((p) => {
                    const st = typeof p.student === 'object' ? p.student : null;
                    const f = typeof p.feeRecord === 'object' ? p.feeRecord : null;
                    return (
                      <li key={p._id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={st?.fullName ?? '?'} className="h-8 w-8" />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{st?.fullName}</p><p className="truncate text-xs text-muted-foreground">{f?.title}</p></div>
                        <div className="text-right"><p className="text-sm font-semibold tabular">{inr(p.amount)}</p><p className="text-xs text-muted-foreground">{fmtDate(p.paidAt)}</p></div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-5 pb-4">
            <div><CardTitle>Outstanding fees</CardTitle><CardDescription>Highest overdue first</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/students?feeStatus=outstanding">View all<ArrowRight /></Link></Button>
          </div>
          {!data ? <div className="space-y-3 px-5 pb-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div> :
            data.outstandingStudents.length === 0 ? <EmptyState icon={Wallet} title="All clear" description="No student has outstanding fees." /> : (
              <ul className="divide-y border-t">
                {data.outstandingStudents.map((o) => (
                  <li key={o._id}>
                    <Link to={`/admin/students/${o.student._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafbfd]">
                      <Avatar name={o.student.fullName} className="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{o.student.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.student.batch} · {o.count} unpaid</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular">{inr(o.outstanding)}</p>
                        {o.overdue > 0 ? <p className="flex items-center justify-end gap-1 text-xs tabular text-red-600"><Dot tone="danger" className="h-1.5 w-1.5" />{inr(o.overdue)} overdue</p> : <p className="text-xs text-muted-foreground">Due {relativeDays(o.oldestDue)}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {quick.map((q) => (
          <button key={q.title} onClick={q.onClick} disabled={q.disabled}
            className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-indigo-200 hover:bg-[#fafbff] disabled:opacity-60">
            <IconChip icon={q.icon as never} className="h-9 w-9" />
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{q.title}</span><span className="block truncate text-xs text-muted-foreground">{q.sub}</span></span>
          </button>
        ))}
      </div>

      <RecordPaymentDialog open={pay} onOpenChange={setPay} onRecorded={reloadAll} />
      <StudentFormDialog open={addStudent} onOpenChange={setAddStudent} onSaved={(st) => navigate(`/admin/students/${st._id}`)} />
      <GenerateFeesDialog open={gen} onOpenChange={setGen} onDone={reloadAll} />
    </>
  );
}
