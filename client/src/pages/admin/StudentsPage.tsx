import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, MoreHorizontal, Pencil, Plus, Archive, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Avatar, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, TableSkeleton } from '@/components/common';
import { StudentFormDialog } from '@/features/students/StudentFormDialog';
import { useApi, useDebounced } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { inr } from '@/utils/format';
import type { Student } from '@/types';

const FEE_BADGE = {
  overdue: <Badge variant="danger">Overdue</Badge>,
  outstanding: <Badge variant="warning">Dues pending</Badge>,
  clear: <Badge variant="success">Clear</Badge>,
};

export default function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const q = useDebounced(search);
  const [course, setCourse] = useState('all');
  const [batch, setBatch] = useState('all');
  const [status, setStatus] = useState('all');
  const [feeStatus, setFeeStatus] = useState(params.get('feeStatus') ?? 'all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Student | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [archiving, setArchiving] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => setPage(1), [q, course, batch, status, feeStatus]);
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('search', q);
    if (feeStatus !== 'all') next.set('feeStatus', feeStatus);
    setParams(next, { replace: true });
  }, [q, feeStatus, setParams]);

  const filters = useApi<{ courses: string[]; batches: string[] }>('/students/filters');
  const { data, meta, loading, error, reload } = useApi<Student[]>('/students', { search: q, course, batch, status, feeStatus, page, limit: 15 });

  const archive = async () => {
    if (!archiving) return;
    setBusy(true);
    try {
      await api.delete(`/students/${archiving._id}`);
      toast.success(`${archiving.fullName} archived`, { description: 'Payment history has been kept.' });
      setArchiving(null);
      reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const rowMenu = (s: Student) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${s.fullName}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => navigate(`/admin/students/${s._id}`)}><Eye />View details</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { setEditing(s); setFormOpen(true); }}><Pencil />Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => setArchiving(s)}><Archive />Archive student</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader title="Students" description={meta ? `${meta.total} student${meta.total === 1 ? '' : 's'}` : 'Manage enrolled students'}
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus />Add student</Button>} />
      <Card>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,minmax(0,160px))]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, ID, email, phone" className="sm:col-span-2 lg:col-span-1" />
          <Select aria-label="Course" value={course} onValueChange={setCourse} options={[{ value: 'all', label: 'All courses' }, ...(filters.data?.courses ?? []).map((c) => ({ value: c, label: c }))]} />
          <Select aria-label="Batch" value={batch} onValueChange={setBatch} options={[{ value: 'all', label: 'All batches' }, ...(filters.data?.batches ?? []).map((c) => ({ value: c, label: c }))]} />
          <Select aria-label="Fee status" value={feeStatus} onValueChange={setFeeStatus} options={[{ value: 'all', label: 'Any fee status' }, { value: 'overdue', label: 'Overdue' }, { value: 'outstanding', label: 'Has dues' }, { value: 'clear', label: 'All paid' }]} />
          <Select aria-label="Status" value={status} onValueChange={setStatus} options={[{ value: 'all', label: 'Any status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        </div>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton rows={8} /> : !data?.length ? (
          <EmptyState icon={GraduationCap} title={q || course !== 'all' || feeStatus !== 'all' ? 'No students match your filters' : 'No students yet'}
            description={q ? 'Try a different search term.' : 'Add your first student to start tracking fees.'}
            action={<Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus />Add student</Button>} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead><TR><TH>Student</TH><TH>Course &amp; batch</TH><TH>Parent</TH><TH className="text-right">Outstanding</TH><TH>Fees</TH><TH className="w-12" /></TR></THead>
                <TBody>
                  {data.map((s) => (
                    <TR key={s._id} className={loading ? 'opacity-60' : ''}>
                      <TD>
                        <Link to={`/admin/students/${s._id}`} className="flex items-center gap-3">
                          <Avatar name={s.fullName} />
                          <span className="min-w-0"><span className="block font-medium text-slate-900 hover:text-primary">{s.fullName}</span><span className="text-xs text-muted-foreground">{s.studentId}{s.status === 'inactive' && ' · Inactive'}</span></span>
                        </Link>
                      </TD>
                      <TD><p>{s.course}</p><p className="text-xs text-muted-foreground">{s.batch}</p></TD>
                      <TD className="text-slate-600">{s.parent?.name ?? <span className="text-slate-400">Not linked</span>}</TD>
                      <TD className="text-right tabular"><span className="font-semibold">{inr(s.fees?.outstanding)}</span>{(s.fees?.overdue ?? 0) > 0 && <span className="block text-xs text-red-600">{inr(s.fees!.overdue)} overdue</span>}</TD>
                      <TD>{FEE_BADGE[s.feeStatus ?? 'clear']}</TD>
                      <TD>{rowMenu(s)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {data.map((s) => (
                <li key={s._id} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/admin/students/${s._id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={s.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.studentId} · {s.course}</p>
                      <div className="mt-1 flex items-center gap-2">{FEE_BADGE[s.feeStatus ?? 'clear']}{(s.fees?.outstanding ?? 0) > 0 && <span className="text-xs tabular">{inr(s.fees!.outstanding)} due</span>}</div>
                    </div>
                  </Link>
                  {rowMenu(s)}
                </li>
              ))}
            </ul>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </Card>
      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} student={editing} onSaved={() => { reload(); filters.reload(); }} />
      <ConfirmDialog open={!!archiving} onOpenChange={(o) => !o && setArchiving(null)} title={`Archive ${archiving?.fullName}?`} destructive confirmLabel="Archive student" loading={busy} onConfirm={archive}
        description={<>The student will be removed from active lists and their login disabled. <strong>All fee records and payment history are kept</strong> for reports and audits.</>} />
    </>
  );
}
