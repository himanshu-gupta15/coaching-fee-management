import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, ArrowLeft, Ban, KeyRound, Mail, MoreHorizontal, Pencil, Phone, Plus, Receipt, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, ErrorState, Field, KV, ProgressBar, StatCard } from '@/components/common';
import { FeeList } from '@/features/fees/FeeList';
import { FeeRecordDialog } from '@/features/fees/FeeDialogs';
import { PaymentList } from '@/features/payments/PaymentList';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { StudentFormDialog } from '@/features/students/StudentFormDialog';
import { useApi } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { fmtDate, fmtDateTime, inr, FREQ_LABEL } from '@/utils/format';
import type { FeeRecord, FeeSummary, Payment, Student } from '@/types';
import { AlertCircle, CircleDollarSign, Clock, Wallet } from 'lucide-react';

interface Detail { student: Student; summary: FeeSummary; fees: FeeRecord[]; payments: Payment[] }

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<Detail>(`/students/${id}`);
  const [edit, setEdit] = useState(false);
  const [payFee, setPayFee] = useState<FeeRecord | null>(null);
  const [feeDialog, setFeeDialog] = useState<{ open: boolean; fee?: FeeRecord | null }>({ open: false });
  const [cancelFee, setCancelFee] = useState<FeeRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [busy, setBusy] = useState(false);

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-8 w-60" /><Skeleton className="h-28" /><Skeleton className="h-80" /></div>;
  const { student: s, summary, fees, payments } = data;
  const paidPct = summary.totalFees ? (summary.totalPaid / summary.totalFees) * 100 : 0;

  const doCancel = async () => {
    if (!cancelFee) return;
    setBusy(true);
    try {
      await api.post(`/fees/records/${cancelFee._id}/cancel`, { reason: cancelReason });
      toast.success('Fee cancelled');
      setCancelFee(null); setCancelReason(''); reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const doArchive = async () => {
    setBusy(true);
    try { await api.delete(`/students/${s._id}`); toast.success('Student archived'); navigate('/admin/students'); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const createLogin = async () => {
    setBusy(true);
    try { await api.post(`/students/${s._id}/account`, { password: loginPw }); toast.success('Student login created', { description: s.email }); setLoginOpen(false); setLoginPw(''); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const feeActions = (f: FeeRecord) => (
    <div className="flex justify-end gap-1">
      {f.balance > 0 && f.status !== 'cancelled' && <Button size="sm" variant="soft" onClick={() => setPayFee(f)}>Record payment</Button>}
      {f.status !== 'cancelled' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More actions for ${f.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setFeeDialog({ open: true, fee: f })}><Pencil />Edit fee</DropdownMenuItem>
            {f.amountPaid === 0 && <DropdownMenuItem destructive onSelect={() => setCancelFee(f)}><Ban />Cancel fee</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <>
      <Link to="/admin/students" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Students</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={s.fullName} className="h-14 w-14 text-base" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{s.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{s.studentId}</span>·<span>{s.course}</span>·<span>{s.batch}</span>
              <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>{s.status === 'active' ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFeeDialog({ open: true })}><Plus />Add fee</Button>
          <Button variant="outline" onClick={() => setEdit(true)}><Pencil />Edit</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!s.user && <DropdownMenuItem onSelect={() => setLoginOpen(true)}><KeyRound />Create student login</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setArchiveOpen(true)}><Archive />Archive student</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total fees" value={inr(summary.totalFees)} icon={Wallet} tone="slate" />
        <StatCard label="Paid" value={inr(summary.totalPaid)} hint={<ProgressBar value={paidPct} className="mt-1" />} icon={CircleDollarSign} tone="emerald" />
        <StatCard label="Outstanding" value={inr(summary.totalPending)} hint={summary.nextDue ? `Next due ${fmtDate(summary.nextDue.dueDate)}` : 'Nothing upcoming'} icon={Clock} tone="amber" />
        <StatCard label="Overdue" value={inr(summary.totalOverdue)} hint={`${summary.overdueCount} overdue fee${summary.overdueCount === 1 ? '' : 's'}`} icon={AlertCircle} tone="red" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card className="min-w-0">
          <Tabs defaultValue="fees">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <TabsList><TabsTrigger value="fees">Fee records ({fees.length})</TabsTrigger><TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger></TabsList>
            </div>
            <TabsContent value="fees"><FeeList items={fees} loading={loading} showStudent={false} actions={feeActions} emptyText="No fees yet. Assign a fee plan and generate fees, or add a one-off fee." /></TabsContent>
            <TabsContent value="payments"><PaymentList items={payments} showStudent={false} /></TabsContent>
          </Tabs>
        </Card>
        <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <dl className="divide-y">
                <KV label="Email"><span className="break-all">{s.email}</span></KV>
                <KV label="Phone">{s.phone || '—'}</KV>
                <KV label="Admitted">{fmtDate(s.admissionDate)}</KV>
                <KV label="Fee plan">{s.feePlan ? <>{s.feePlan.name}<span className="block text-xs font-normal text-muted-foreground">{inr(s.feePlan.amount)} · {FREQ_LABEL[s.feePlan.frequency]}</span></> : <span className="text-slate-400">None</span>}</KV>
                <KV label="Student login">{s.user ? <span className="text-emerald-700">Enabled{s.user.lastLoginAt && <span className="block text-xs font-normal text-muted-foreground">Last seen {fmtDateTime(s.user.lastLoginAt)}</span>}</span> : <button className="text-primary hover:underline" onClick={() => setLoginOpen(true)}>Create login</button>}</KV>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Parent / guardian</CardTitle></CardHeader>
            <CardContent>
              {s.parent ? (
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4 text-slate-400" />{s.parent.name}</p>
                  <p className="flex items-center gap-2 text-slate-600"><Mail className="h-4 w-4 text-slate-400" /><span className="break-all">{s.parent.email}</span></p>
                  {s.parent.phone && <p className="flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 text-slate-400" /><a href={`tel:${s.parent.phone}`} className="hover:underline">{s.parent.phone}</a></p>}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No parent linked. <button className="font-medium text-primary hover:underline" onClick={() => setEdit(true)}>Link a parent</button></div>
              )}
            </CardContent>
          </Card>
          {summary.totalPending > 0 && (
            <Button className="w-full" onClick={() => setPayFee(fees.filter((f) => f.balance > 0 && f.status !== 'cancelled').sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0] ?? null)}>
              <Receipt />Record payment for oldest due
            </Button>
          )}
        </div>
      </div>

      <StudentFormDialog open={edit} onOpenChange={setEdit} student={s} onSaved={reload} />
      <RecordPaymentDialog open={!!payFee} onOpenChange={(o) => !o && setPayFee(null)} fee={payFee} studentName={s.fullName} onRecorded={reload} />
      <FeeRecordDialog open={feeDialog.open} onOpenChange={(o) => setFeeDialog({ open: o })} fee={feeDialog.fee} student={feeDialog.fee ? null : s} onSaved={reload} />
      <ConfirmDialog open={!!cancelFee} onOpenChange={(o) => !o && setCancelFee(null)} title="Cancel this fee?" destructive confirmLabel="Cancel fee" loading={busy} onConfirm={doCancel}
        description={<>“{cancelFee?.title}” for {inr(cancelFee?.amount)} will be marked as cancelled and excluded from dues. This is recorded in the audit log.</>}>
        <Field label="Reason" htmlFor="cancel-reason" className="mt-4"><Input id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Scholarship granted" /></Field>
      </ConfirmDialog>
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title={`Archive ${s.fullName}?`} destructive confirmLabel="Archive" loading={busy} onConfirm={doArchive}
        description="The student is hidden from active lists and their login is disabled. All fee and payment history is retained." />
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create student login</DialogTitle><DialogDescription>The student will sign in with {s.email}.</DialogDescription></DialogHeader>
          <Field label="Initial password" htmlFor="slp" hint="At least 8 characters with a letter and a number."><Input id="slp" type="password" autoComplete="new-password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setLoginOpen(false)}>Cancel</Button><Button loading={busy} disabled={!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(loginPw)} onClick={createLogin}>Create login</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
