import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ChevronRight, Megaphone, Receipt, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, EmptyState, ErrorState, ProgressBar, StatusBadge } from '@/components/common';
import { downloadReceipt } from '@/features/payments/PaymentList';
import { useApi } from '@/hooks/useApi';
import { useAppSelector } from '@/store';
import { fmtDate, inr, relativeDays } from '@/utils/format';
import type { Announcement, FeeRecord, FeeSummary, Payment, Student } from '@/types';

interface ParentDashboard {
  children: (Student & { summary: FeeSummary })[];
  summary: FeeSummary;
  upcoming: (FeeRecord & { student: { _id: string; fullName: string } })[];
  recentPayments: Payment[];
  unreadNotifications: number;
  announcements: Announcement[];
}

export default function ParentHomePage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const { data, error, reload } = useApi<ParentDashboard>('/parents/me/dashboard');
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  const sum = data?.summary;
  const allClear = sum && sum.totalPending === 0;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Hello, {user.name.split(' ')[0]} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here is a summary of your {data?.children.length === 1 ? "child's" : "children's"} fees.</p>
      </section>

      {!sum ? <Skeleton className="h-36 rounded-xl" /> : (
        <Card className={allClear ? 'border-emerald-200 bg-emerald-50/50' : sum.totalOverdue > 0 ? 'border-red-200 bg-gradient-to-br from-red-50/80 to-white' : 'bg-gradient-to-br from-indigo-50/70 to-white'}>
          <CardContent className="p-5 sm:p-6">
            {allClear ? (
              <div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><div><p className="text-lg font-semibold text-emerald-900">All fees are paid</p><p className="text-sm text-emerald-800">Thank you! There is nothing due right now.</p></div></div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total amount due</p>
                  <p className="mt-1 text-3xl font-semibold tabular tracking-tight sm:text-4xl">{inr(sum.totalPending)}</p>
                  {sum.totalOverdue > 0 && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-sm font-medium text-red-800"><AlertCircle className="h-4 w-4" />{inr(sum.totalOverdue)} is overdue</p>}
                  {sum.nextDue && <p className="mt-2 text-sm text-slate-600">Next payment: <span className="font-medium text-slate-900">{inr(sum.nextDue.balance)}</span> due {fmtDate(sum.nextDue.dueDate)} ({relativeDays(sum.nextDue.dueDate)})</p>}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm sm:text-right">
                  <div><p className="text-muted-foreground">Total fees</p><p className="font-semibold tabular">{inr(sum.totalFees)}</p></div>
                  <div><p className="text-muted-foreground">Paid so far</p><p className="font-semibold tabular text-emerald-700">{inr(sum.totalPaid)}</p></div>
                </div>
              </div>
            )}
            {!allClear && <p className="mt-4 rounded-lg bg-white/70 p-3 text-xs text-slate-600">To pay, visit the institute office (cash) or transfer to the institute bank account and share the transaction reference with the office. Your receipt will appear here once recorded.</p>}
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">Your children</h2>
        {!data ? <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : data.children.length === 0 ? (
          <Card><EmptyState icon={Wallet} title="No students linked yet" description="Please contact the institute office to link your child to your account." /></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.children.map((c) => {
              const pct = c.summary.totalFees ? (c.summary.totalPaid / c.summary.totalFees) * 100 : 100;
              return (
                <Link key={c._id} to={`/parent/children/${c._id}`} className="group">
                  <Card className="h-full p-4 transition-shadow group-hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.fullName} className="h-11 w-11" />
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.fullName}</p><p className="truncate text-xs text-muted-foreground">{c.course} · {c.batch}</p></div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary" />
                    </div>
                    <div className="mt-4 flex items-end justify-between text-sm">
                      <div><p className="text-xs text-muted-foreground">Due</p><p className="font-semibold tabular">{inr(c.summary.totalPending)}</p></div>
                      {c.summary.totalOverdue > 0 ? <span className="text-xs font-medium text-red-600">{inr(c.summary.totalOverdue)} overdue</span> : c.summary.totalPending === 0 ? <span className="text-xs font-medium text-emerald-700">All paid</span> : <span className="text-xs text-muted-foreground">On track</span>}
                    </div>
                    <ProgressBar value={pct} className="mt-2" />
                    <p className="mt-1 text-xs text-muted-foreground">{Math.round(pct)}% of fees paid</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" />Upcoming &amp; unpaid</CardTitle><CardDescription>Oldest first</CardDescription></CardHeader>
          <CardContent className="px-0 pb-2">
            {!data ? <div className="space-y-2 px-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : data.upcoming.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing due" /> : (
              <ul className="divide-y">
                {data.upcoming.map((f) => (
                  <li key={f._id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{f.title}</p><p className="text-xs text-muted-foreground">{f.student.fullName} · due {fmtDate(f.dueDate)}</p></div>
                    <div className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-semibold tabular">{inr(f.balance)}</span><StatusBadge status={f.effectiveStatus} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" />Recent payments</CardTitle><CardDescription>Tap to download a receipt</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/parent/payments">All<ArrowRight /></Link></Button></CardHeader>
          <CardContent className="px-0 pb-2">
            {!data ? <div className="space-y-2 px-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : data.recentPayments.length === 0 ? <EmptyState icon={Receipt} title="No payments yet" /> : (
              <ul className="divide-y">
                {data.recentPayments.map((p) => (
                  <li key={p._id}>
                    <button onClick={() => downloadReceipt(p)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50">
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{typeof p.feeRecord === 'object' ? p.feeRecord.title : ''}</p><p className="text-xs text-muted-foreground">{typeof p.student === 'object' ? p.student.fullName : ''} · {fmtDate(p.paidAt)}</p></div>
                      <span className="text-sm font-semibold tabular text-emerald-700">{inr(p.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data && data.announcements.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />From the institute</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/parent/announcements">All<ArrowRight /></Link></Button></CardHeader>
          <CardContent className="space-y-3">
            {data.announcements.map((a) => <div key={a._id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm font-medium">{a.title}</p><p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{a.body}</p></div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
