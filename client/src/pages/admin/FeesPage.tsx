import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, MoreHorizontal, Pencil, Plus, Trash2, Wallet, Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState, ErrorState, Field, PageHeader, Pagination, SearchInput } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { FeeList } from '@/features/fees/FeeList';
import { FeeRecordDialog, FeeStructureDialog, GenerateFeesDialog } from '@/features/fees/FeeDialogs';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { useApi, useDebounced } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { FREQ_LABEL, inr } from '@/utils/format';
import type { FeeRecord, FeeStructure } from '@/types';

function Records() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status, plan, dueFrom, dueTo]);
  const plans = useApi<FeeStructure[]>('/fees/structures');
  const { data, meta, loading, error, reload } = useApi<FeeRecord[]>('/fees/records', { search: q, status, feeStructure: plan, dueFrom, dueTo, page, limit: 20 });
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
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setEdit({ open: true })}><Plus />One-off fee</Button>
        <Button onClick={() => setGen(true)}><CalendarPlus />Generate fees</Button>
      </div>
      <Card>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_200px_150px_150px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search student name or ID" className="sm:col-span-2 lg:col-span-1" />
          <Select aria-label="Status" value={status} onValueChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'outstanding', label: 'All unpaid' }, { value: 'overdue', label: 'Overdue' }, { value: 'pending', label: 'Pending' }, { value: 'partial', label: 'Partially paid' }, { value: 'paid', label: 'Paid' }, { value: 'cancelled', label: 'Cancelled' }]} />
          <Select aria-label="Fee plan" value={plan} onValueChange={setPlan} options={[{ value: 'all', label: 'All fee plans' }, ...(plans.data ?? []).map((p) => ({ value: p._id, label: p.name }))]} />
          <Input type="date" aria-label="Due from" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
          <Input type="date" aria-label="Due to" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
        </div>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : (
          <FeeList items={data} loading={loading} emptyText="Try changing the filters, or generate this month's fees."
            actions={(f) => (
              <div className="flex justify-end gap-1">
                {f.balance > 0 && f.status !== 'cancelled' && <Button size="sm" variant="soft" onClick={() => setPayFee(f)}>Record payment</Button>}
                {f.status !== 'cancelled' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More actions for ${f.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEdit({ open: true, fee: f })}><Pencil />Edit</DropdownMenuItem>
                      {f.amountPaid === 0 && <DropdownMenuItem destructive onSelect={() => setCancel(f)}><Ban />Cancel fee</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )} />
        )}
        <Pagination meta={meta} onPage={setPage} />
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
      <PageHeader title="Fees" description="Fee records, plans and monthly generation" />
      <Tabs defaultValue="records">
        <TabsList className="mb-4"><TabsTrigger value="records">Fee records</TabsTrigger><TabsTrigger value="plans">Fee plans</TabsTrigger></TabsList>
        <TabsContent value="records"><Records /></TabsContent>
        <TabsContent value="plans"><Plans /></TabsContent>
      </Tabs>
    </>
  );
}
