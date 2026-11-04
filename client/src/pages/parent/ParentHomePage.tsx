import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Download, Info, Megaphone, Pin, Receipt, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, Dot, EmptyState, ErrorState, IconChip, ProgressBar, StatusBadge } from '@/components/common';
import { downloadReceipt } from '@/features/payments/PaymentList';
import { useApi } from '@/hooks/useApi';
import { useAppSelector } from '@/store';
import { fmtDate, inr, relativeDays } from '@/utils/format';
import type { Announcement, FeeRecord, FeeStatus, FeeSummary, Payment, Student } from '@/types';

interface ParentDashboard {
  children: (Student & { summary: FeeSummary })[];
  summary: FeeSummary;
  upcoming: (FeeRecord & { student: { _id: string; fullName: string } })[];
  recentPayments: Payment[];
  unreadNotifications: number;
  announcements: Announcement[];
}

const planOf = (t: string) => (t.includes(' — ') ? t.slice(0, t.lastIndexOf(' — ')) : t);
const periodOf = (t: string) => (t.includes(' — ') ? t.slice(t.lastIndexOf(' — ') + 3) : t);
const first = (n?: string) => n?.split(' ')[0] ?? '';

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2>{action}</div>;
}

export default function ParentHomePage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const { data, error, reload } = useApi<ParentDashboard>('/parents/me/dashboard');
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  const sum = data?.summary;
  const upcomingAmt = sum ? sum.totalPending - sum.totalOverdue : 0;
  const n = data?.children.length ?? 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-[26px] font-semibold tracking-tight">Welcome back, {first(user.name)}.</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{data ? `Here's where fees stand for your ${n === 1 ? 'child' : `${n} children`}.` : 'Loading your summary…'}</p>
      </section>

      {!sum ? <Skeleton className="h-48 rounded-xl" /> : (
        <Card className="overflow-hidden">
          {sum.totalPending === 0 ? (
            <div className="flex items-center gap-3 p-6"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><div><p className="text-lg font-semibold">All fees are paid</p><p className="text-sm text-muted-foreground">Thank you! There is nothing due right now.</p></div></div>
          ) : (
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:gap-10">
              <div>
                <p className="text-sm text-muted-foreground">Total outstanding</p>
                <p className="mt-1 text-[40px] font-semibold leading-none tabular tracking-tight">{inr(sum.totalPending)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {sum.totalOverdue > 0 && <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[13px] font-medium text-red-700"><Dot tone="danger" className="h-1.5 w-1.5" />{inr(sum.totalOverdue)} is overdue</span>}
                  {upcomingAmt > 0 && <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[13px] text-slate-700"><Dot tone="warning" className="h-1.5 w-1.5" />{inr(upcomingAmt)} upcoming</span>}
                </div>
              </div>
              <div className="hidden w-px bg-border md:block" />
              <div className="border-t pt-5 md:border-0 md:pt-0">
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" />Next payment due</p>
                {sum.nextDue ? (
                  <>
                    <p className="mt-1.5 text-lg font-semibold">{fmtDate(sum.nextDue.dueDate)} <span className="text-sm font-normal text-muted-foreground">· {relativeDays(sum.nextDue.dueDate)}</span></p>
                    <p className="text-sm text-slate-700"><span className="font-medium tabular">{inr(sum.nextDue.balance)}</span> for {planOf(sum.nextDue.title)}</p>
                  </>
                ) : <p className="mt-1.5 text-sm text-slate-700">Nothing upcoming — only overdue fees remain.</p>}
                <div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Paid <span className="font-medium text-foreground tabular">{inr(sum.totalPaid)}</span></span><span className="tabular">of {inr(sum.totalFees)}</span></div>
                <ProgressBar className="mt-1.5" value={sum.totalFees ? (sum.totalPaid / sum.totalFees) * 100 : 0} />
              </div>
            </div>
          )}
          {sum.totalPending > 0 && (
            <p className="flex gap-2.5 border-t bg-[#fafbfd] px-6 py-3.5 text-[13px] text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              To pay, visit the institute office (cash) or transfer to the institute's bank account and share the transaction reference with the office. Your receipt appears here once it's recorded.
            </p>
          )}
        </Card>
      )}

      <section>
        <SectionHead title="Your children" />
        {!data ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div> : data.children.length === 0 ? (
          <Card><EmptyState icon={Wallet} title="No students linked yet" description="Please contact the institute office to link your child to your account." /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.children.map((c) => {
              const pct = c.summary.totalFees ? (c.summary.totalPaid / c.summary.totalFees) * 100 : 100;
              const st: FeeStatus = c.summary.totalOverdue > 0 ? 'overdue' : c.summary.totalPending > 0 ? 'pending' : 'paid';
              return (
                <Card key={c._id} className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={c.fullName} className="h-11 w-11" />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.fullName}</p><p className="truncate text-[13px] text-muted-foreground">{c.course} · {c.batch}</p></div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-2">
                    <div><p className="text-xs text-muted-foreground">Due now</p><p className="text-xl font-semibold tabular">{inr(c.summary.totalPending)}</p></div>
                    {c.summary.totalOverdue > 0 ? <p className="text-[13px] tabular text-red-600">{inr(c.summary.totalOverdue)} overdue</p>
                      : c.summary.nextDue ? <p className="text-[13px] text-muted-foreground">Next due {fmtDate(c.summary.nextDue.dueDate)}</p> : null}
                  </div>
                  <ProgressBar className="mt-3" value={pct} />
                  <div className="mt-3 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{Math.round(pct)}% of fees paid</span>
                    <Link to={`/parent/children/${c._id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline" aria-label={`View fees for ${c.fullName}`}>View fees<ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4"><h2 className="font-semibold">Upcoming &amp; unpaid</h2><span className="text-xs text-muted-foreground">Oldest first</span></div>
          {!data ? <div className="space-y-2 px-5 pb-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : data.upcoming.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing due" className="border-t" /> : (
            <ul className="divide-y border-t">
              {data.upcoming.map((f) => (
                <li key={f._id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{periodOf(f.title)}</p><p className="truncate text-xs text-muted-foreground">{f.student.fullName} · due {fmtDate(f.dueDate)}</p></div>
                  <div className="flex shrink-0 flex-col items-end gap-1"><span className="text-sm font-semibold tabular">{inr(f.balance)}</span><StatusBadge status={f.effectiveStatus} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3"><h2 className="font-semibold">Recent payments</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/parent/payments">See all<ArrowRight /></Link></Button></div>
          {!data ? <div className="space-y-2 px-5 pb-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : data.recentPayments.length === 0 ? <EmptyState icon={Receipt} title="No payments yet" className="border-t" /> : (
            <ul className="divide-y border-t">
              {data.recentPayments.map((p) => {
                const f = typeof p.feeRecord === 'object' ? p.feeRecord : null;
                const s = typeof p.student === 'object' ? p.student : null;
                return (
                  <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><p className="truncate text-sm"><span className="font-semibold tabular">{inr(p.amount)}</span> · {first(s?.fullName)}</p><p className="truncate text-xs text-muted-foreground">{fmtDate(p.paidAt)} · {f ? periodOf(f.title) : ''}</p></div>
                    <Button variant="outline" size="sm" onClick={() => downloadReceipt(p)} aria-label={`Download receipt ${p.receiptNumber}`}><Download />Receipt</Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {data && data.announcements.length > 0 && (
        <section>
          <SectionHead title="From the institute" action={<Button variant="ghost" size="sm" asChild><Link to="/parent/announcements">All notices<ArrowRight /></Link></Button>} />
          <div className="grid gap-4 md:grid-cols-2">
            {data.announcements.slice(0, 2).map((a) => (
              <Card key={a._id} className="flex gap-3 p-4">
                <IconChip icon={a.pinned ? Pin : Megaphone} className="h-8 w-8" />
                <div className="min-w-0"><p className="text-sm font-medium">{a.title}</p><p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{a.body}</p><p className="mt-1.5 text-xs text-muted-foreground">{fmtDate(a.createdAt)}</p></div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
