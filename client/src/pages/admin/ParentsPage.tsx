import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, KeyRound, Link2, MoreHorizontal, Pencil, Plus, Power, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, EmptyState, ErrorState, Field, PageHeader, Pagination, SearchInput, TableSkeleton } from '@/components/common';
import { Input } from '@/components/ui/input';
import { ParentFormDialog } from '@/features/parents/ParentFormDialog';
import { useApi, useDebounced } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import type { Student, User } from '@/types';

type ParentRow = User & { children: Pick<Student, '_id' | 'fullName' | 'studentId' | 'course' | 'batch' | 'status'>[] };

export default function ParentsPage() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status]);
  const { data, meta, loading, error, reload } = useApi<ParentRow[]>('/parents', { search: q, status, page, limit: 15 });
  const [form, setForm] = useState<{ open: boolean; parent?: User | null }>({ open: false });
  const [linkFor, setLinkFor] = useState<ParentRow | null>(null);
  const [linkStudent, setLinkStudent] = useState('');
  const [unlink, setUnlink] = useState<{ parent: ParentRow; child: ParentRow['children'][number] } | null>(null);
  const [toggle, setToggle] = useState<ParentRow | null>(null);
  const [resetLink, setResetLink] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const allStudents = useApi<Student[]>(linkFor ? '/students' : null, { limit: 100 });

  const doLink = async () => {
    if (!linkFor || !linkStudent) return;
    setBusy(true);
    try { await api.post(`/parents/${linkFor._id}/students`, { studentId: linkStudent }); toast.success('Student linked'); setLinkFor(null); setLinkStudent(''); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const doUnlink = async () => {
    if (!unlink) return;
    setBusy(true);
    try { await api.delete(`/parents/${unlink.parent._id}/students/${unlink.child._id}`); toast.success('Student unlinked'); setUnlink(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const doToggle = async () => {
    if (!toggle) return;
    setBusy(true);
    try { await api.patch(`/users/${toggle._id}/status`, { isActive: !toggle.isActive }); toast.success(toggle.isActive ? 'Account disabled' : 'Account enabled'); setToggle(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const issueReset = async (p: ParentRow) => {
    try { const { data: r } = await api.post(`/users/${p._id}/reset-link`); setResetLink({ name: p.name, url: r.data.resetUrl }); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const menu = (p: ParentRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setForm({ open: true, parent: p })}><Pencil />Edit details</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setLinkFor(p)}><Link2 />Link a student</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => issueReset(p)}><KeyRound />Issue password reset link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive={p.isActive} onSelect={() => setToggle(p)}><Power />{p.isActive ? 'Disable account' : 'Enable account'}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader title="Parents" description="Parent accounts and the students linked to them" actions={<Button onClick={() => setForm({ open: true })}><Plus />Add parent</Button>} />
      <Card>
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone" className="flex-1" />
          <Select aria-label="Account status" className="sm:w-44" value={status} onValueChange={setStatus} options={[{ value: 'all', label: 'All accounts' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Disabled' }]} />
        </div>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : !data?.length ? (
          <EmptyState icon={Users} title="No parents found" description="Create a parent account and link their children." action={<Button size="sm" onClick={() => setForm({ open: true })}><Plus />Add parent</Button>} />
        ) : (
          <ul className="divide-y">
            {data.map((p) => (
              <li key={p._id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={p.name} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">{p.name}{!p.isActive && <Badge variant="neutral">Disabled</Badge>}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}{p.phone && ` · ${p.phone}`}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5 pl-12 sm:pl-0">
                  {p.children.length === 0 && <span className="text-xs text-slate-400">No students linked</span>}
                  {p.children.map((c) => (
                    <span key={c._id} className="inline-flex items-center gap-1 rounded-full border bg-white py-0.5 pl-2.5 pr-1 text-xs">
                      <Link to={`/admin/students/${c._id}`} className="font-medium hover:text-primary">{c.fullName}</Link>
                      <button onClick={() => setUnlink({ parent: p, child: c })} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label={`Unlink ${c.fullName}`}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  <button onClick={() => setLinkFor(p)} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-slate-500 hover:border-primary hover:text-primary"><Plus className="h-3 w-3" />Link</button>
                </div>
                <div className="self-end sm:self-auto">{menu(p)}</div>
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Card>

      <ParentFormDialog open={form.open} onOpenChange={(o) => setForm({ open: o })} parent={form.parent} onSaved={reload} />
      <Dialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link a student to {linkFor?.name}</DialogTitle><DialogDescription>The parent will be able to see this student's fees and receipts. A student can have one linked parent account; linking moves it from any previous parent.</DialogDescription></DialogHeader>
          <Field label="Student" htmlFor="link-student">
            <Select id="link-student" value={linkStudent} onValueChange={setLinkStudent} placeholder="Select student"
              options={(allStudents.data ?? []).filter((s) => s.parent?._id !== linkFor?._id).map((s) => ({ value: s._id, label: `${s.fullName} (${s.studentId})${s.parent ? ` — currently ${s.parent.name}` : ''}` }))} />
          </Field>
          <DialogFooter><Button variant="outline" onClick={() => setLinkFor(null)}>Cancel</Button><Button onClick={doLink} loading={busy} disabled={!linkStudent}>Link student</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!unlink} onOpenChange={(o) => !o && setUnlink(null)} title="Unlink student?" destructive confirmLabel="Unlink" loading={busy} onConfirm={doUnlink}
        description={<>{unlink?.parent.name} will no longer see {unlink?.child.fullName}'s fees or receipts.</>} />
      <ConfirmDialog open={!!toggle} onOpenChange={(o) => !o && setToggle(null)} title={toggle?.isActive ? `Disable ${toggle?.name}?` : `Enable ${toggle?.name}?`} destructive={toggle?.isActive} confirmLabel={toggle?.isActive ? 'Disable' : 'Enable'} loading={busy} onConfirm={doToggle}
        description={toggle?.isActive ? 'They will be signed out and unable to log in until re-enabled.' : 'They will be able to sign in again.'} />
      <Dialog open={!!resetLink} onOpenChange={(o) => !o && setResetLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Password reset link</DialogTitle><DialogDescription>Share this single-use link with {resetLink?.name} through a trusted channel. It expires in 30 minutes.</DialogDescription></DialogHeader>
          <div className="flex gap-2"><Input readOnly value={resetLink?.url ?? ''} aria-label="Reset link" onFocus={(e) => e.target.select()} />
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(resetLink!.url); toast.success('Link copied'); }}><Copy />Copy</Button></div>
          <DialogFooter><Button onClick={() => setResetLink(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
