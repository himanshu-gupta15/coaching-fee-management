import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, CalendarPlus, Info, MoreHorizontal, Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dot, EmptyState, ErrorState, Field, PageHeader, Pagination, SearchInput, SegmentedBar } from '@/components/common';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { FeeList } from '@/features/fees/FeeList';
import { FeeRecordDialog, FeeStructureDialog, GenerateFeesDialog } from '@/features/fees/FeeDialogs';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { useApi, useDebounced } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { FREQ_LABEL, inr } from '@/utils/format';
import type { FeeRecord, FeeStructure } from '@/types';

const STATUS_TABS = [
  { value: 'all', label: 'All' }, { value: 'outstanding', label: 'Unpaid' }, { value: 'overdue', label: 'Overdue' }, { value: 'partial', label: 'Partial' },
  { value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }, { value: 'cancelled', label: 'Cancelled' },
];

interface Stats { totalBilled: number; totalCollected: number; pendingAmount: number; overdueAmount: number; overdueCount: number; collectionRate: number }

function SummaryCard({ stats }: { stats: Stats | null }) {
  const notDue = stats ? stats.pendingAmount - stats.overdueAmount : 0;
  const cols = [
    { label: 'Total billed', value: stats?.totalBilled, sub: undefined, dot: null, info: 'All fee records except cancelled ones' },
    { label: 'Paid', value: stats?.totalCollected, sub: stats && `${stats.collectionRate}% collected`, dot: 'success' as const },
    { label: 'Pending', value: notDue, sub: 'Not yet due', dot: 'warning' as const, info: 'Unpaid balances not yet past due' },
    { label: 'Overdue', value: stats?.overdueAmount, sub: stats && `${stats.overdueCount} fees`, dot: 'danger' as const, info: 'Unpaid balances past due date' },
  ];
  return (
    <Card className="mb-4 p-5">
      <div className="grid grid-cols-2 gap-y-4 lg:grid-cols-4 lg:divide-x">
        {cols.map((c) => (
          <div key={c.label} className="lg:px-6 lg:first:pl-0">
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">{c.dot && <Dot tone={c.dot} />}{c.label}{c.info && <span title={c.info}><Info className="h-3.5 w-3.5 text-slate-400" aria-label={c.info} /></span>}</p>
            <p className="mt-1 text-xl font-semibold tabular sm:text-[22px]">{stats ? inr(c.value ?? 0) : '—'}</p>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          </div>
        ))}
      </div>
      {stats && <SegmentedBar className="mt-5" parts={[
        { label: 'Paid', value: stats.totalCollected, className: 'bg-emerald-500' },
        { label: 'Pending', value: notDue, className: 'bg-amber-400' },
        { label: 'Overdue', value: stats.overdueAmount, className: 'bg-red-500' },
      ]} />}
    </Card>
  );
}

function Records() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const status = params.get('status') ?? 'all';
  const setStatus = (v: string) => { const n = new URLSearchParams(params); if (v === 'all') n.delete('status'); else n.set('status', v); setParams(n, { replace: true }); };
  const dash = useApi<{ stats: Stats }>('/reports/dashboard');
  const [plan, setPlan] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status, plan, dueFrom, dueTo]);
  const plans = useApi<FeeStructure[]>('/fees/structures');
  const { data, meta, loading, error, reload: reloadList } = useApi<FeeRecord[]>('/fees/records', { search: q, status, feeStructure: plan, dueFrom, dueTo, page, limit: 15 });
  const reload = () => { void reloadList(); void dash.reload(); };
  const [payFee, setPayFee] = useState<FeeRecord | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; fee?: FeeRecord | null }>({ open: false });
  const [gen, setGen] = useState(false);
  const [cancel, setCancel] = useState<FeeRecord | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const doCancel = async () => {
    setBusy(true);
    try { await api.post(`/fees/records/${cancel!._id}/cancel`, { reason }); toast.success('Fee cancelled'); setCancel(null); setReason(''); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <SummaryCard stats={dash.data?.stats ?? null} />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((t) => (
              <button key={t.value} role="tab" aria-selected={status === t.value} onClick={() => setStatus(t.value)}
                className={cn('whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium', status === t.value ? 'bg-white text-foreground shadow-sm' : 'text-slate-600 hover:text-foreground')}>{t.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setEdit({ open: true })}><Plus />One-off fee</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setGen(true)}><CalendarPlus />Generate fees</Button>
          </div>
        </div>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[1fr_200px_auto]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student name or ID" className="sm:col-span-2 lg:col-span-1" />
          <Select aria-label="Fee plan" value={plan} onValueChange={setPlan} options={[{ value: 'all', label: 'All fee plans' }, ...(plans.data ?? []).map((p) => ({ value: p._id, label: p.name }))]} />
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground sm:col-span-2 lg:col-span-1">
            <span className="whitespace-nowrap">Due from</span>
            <Input type="date" aria-label="Due from" className="min-w-0 lg:w-[150px]" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
            <span>to</span>
            <Input type="date" aria-label="Due to" className="min-w-0 lg:w-[150px]" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
        </div>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : (
          <FeeList items={data} loading={loading} emptyText="Try changing the filters, or generate this month's fees."
            actions={(f) => (
              <div className="flex justify-end gap-1">
                {f.balance > 0 && f.status !== 'cancelled' && <Button size="sm" variant="soft" onClick={() => setPayFee(f)}><Receipt />Record payment</Button>}
                {f.status !== 'cancelled' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`More actions for ${f.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEdit({ open: true, fee: f })}><Pencil />Edit</DropdownMenuItem>
                      {f.amountPaid === 0 && <DropdownMenuItem destructive onSelect={() => setCancel(f)}><Ban />Cancel fee</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )} />
        )}
        <Pagination meta={meta} onPage={setPage} noun="fee records" />
      </Card>
      <RecordPaymentDialog open={!!payFee} onOpenChange={(o) => !o && setPayFee(null)} fee={payFee} onRecorded={reload} />
      <FeeRecordDialog open={edit.open} onOpenChange={(o) => setEdit({ open: o })} fee={edit.fee} onSaved={reload} />
      <GenerateFeesDialog open={gen} onOpenChange={setGen} onDone={reload} />
      <ConfirmDialog open={!!cancel} onOpenChange={(o) => !o && setCancel(null)} title="Cancel this fee?" destructive confirmLabel="Cancel fee" loading={busy} onConfirm={doCancel}
        description={<>“{cancel?.title}” will no longer count as due. Only fees without payments can be cancelled.</>}>
        <Field label="Reason" htmlFor="fc-reason" className="mt-4"><Input id="fc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fee waived" /></Field>
      </ConfirmDialog>
    </>
  );
}

function Plans() {
  const { data, loading, error, reload } = useApi<FeeStructure[]>('/fees/structures');
  const [form, setForm] = useState<{ open: boolean; plan?: FeeStructure | null }>({ open: false });
  const [del, setDel] = useState<FeeStructure | null>(null);
  const [busy, setBusy] = useState(false);
  const doDelete = async () => {
    setBusy(true);
    try { const { data: r } = await api.delete(`/fees/structures/${del!._id}`); toast.success(r.data.message); setDel(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setForm({ open: true })}><Plus />New fee plan</Button></div>
      {loading && !data ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div> : !data?.length ? (
        <Card><EmptyState icon={Wallet} title="No fee plans" description="Create a plan such as “JEE Monthly — ₹6,500” and assign it to students." action={<Button size="sm" onClick={() => setForm({ open: true })}><Plus />New fee plan</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card key={p._id} className={p.isActive ? '' : 'opacity-70'}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div className="min-w-0"><CardTitle className="truncate">{p.name}</CardTitle><CardDescription>{p.course}</CardDescription></div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setForm({ open: true, plan: p })}><Pencil />Edit</DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => setDel(p)}><Trash2 />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular">{inr(p.amount)}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {FREQ_LABEL[p.frequency].toLowerCase()}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="neutral">Due day {p.dueDay}</Badge>
                  <Badge variant="info">{p.studentCount ?? 0} students</Badge>
                  {!p.isActive && <Badge variant="warning">Inactive</Badge>}
                </div>
                {p.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FeeStructureDialog open={form.open} onOpenChange={(o) => setForm({ open: o })} plan={form.plan} onSaved={reload} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.name}?`} destructive confirmLabel="Delete" loading={busy} onConfirm={doDelete}
        description="If students or fee records use this plan, it will be deactivated instead so history is preserved." />
    </>
  );
}

export default function FeesPage() {
  return (
    <>
      <PageHeader title="Fee Management" description="Every fee issued to students, what has been paid against it, and what is still due." />
      <Tabs defaultValue="records">
        <TabsList variant="underline" className="mb-5"><TabsTrigger value="records">Fee records</TabsTrigger><TabsTrigger value="plans">Fee plans</TabsTrigger></TabsList>
        <TabsContent value="records"><Records /></TabsContent>
        <TabsContent value="plans"><Plans /></TabsContent>
      </Tabs>
    </>
  );
}
