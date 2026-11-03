import { useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/common';
import { AnnouncementDialog } from '@/features/announcements/AnnouncementDialog';
import { useApi } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { fmtDateTime } from '@/utils/format';
import type { Announcement } from '@/types';

const AUD = { all: 'Everyone', parents: 'Parents', students: 'Students' };

export default function AnnouncementsPage() {
  const { data, loading, error, reload } = useApi<Announcement[]>('/announcements');
  const [form, setForm] = useState<{ open: boolean; item?: Announcement | null }>({ open: false });
  const [del, setDel] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const doDelete = async () => {
    setBusy(true);
    try { await api.delete(`/announcements/${del!._id}`); toast.success('Announcement deleted'); setDel(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Announcements" description="Notices shown in parent and student portals" actions={<Button onClick={() => setForm({ open: true })}><Plus />New announcement</Button>} />
      <Card>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : !data?.length ? (
          <EmptyState icon={Megaphone} title="No announcements" description="Post holiday notices, exam schedules or fee reminders." action={<Button size="sm" onClick={() => setForm({ open: true })}><Plus />New announcement</Button>} />
        ) : (
          <ul className="divide-y">
            {data.map((a) => (
              <li key={a._id} className="flex gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" aria-label="Pinned" />}
                    <p className="font-medium">{a.title}</p>
                    <Badge variant="neutral">{AUD[a.audience]}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}{typeof a.createdBy === 'object' && ` · ${a.createdBy.name}`}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${a.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setForm({ open: true, item: a })}><Pencil />Edit</DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => setDel(a)}><Trash2 />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <AnnouncementDialog open={form.open} onOpenChange={(o) => setForm({ open: o })} item={form.item} onSaved={reload} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete announcement?" destructive confirmLabel="Delete" loading={busy} onConfirm={doDelete} description={`“${del?.title}” will be removed from all portals.`} />
    </>
  );
}
