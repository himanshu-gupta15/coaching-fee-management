import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Bell, CalendarClock, CheckCheck, CheckCircle2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { api, errMsg } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUnread } from '@/store/uiSlice';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/utils/format';
import type { Notification } from '@/types';

const ICON = {
  fee_due: { icon: CalendarClock, cls: 'bg-amber-50 text-amber-600' },
  fee_overdue: { icon: AlertCircle, cls: 'bg-red-50 text-red-600' },
  payment_success: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
  announcement: { icon: Megaphone, cls: 'bg-indigo-50 text-indigo-600' },
  system: { icon: Bell, cls: 'bg-slate-100 text-slate-600' },
};

export default function NotificationsPage() {
  const role = useAppSelector((s) => s.auth.user!.role);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload, setData } = useApi<Notification[]>('/notifications', { unread: tab === 'unread' ? 'true' : undefined, page, limit: 20 });

  const target = (n: Notification) => {
    if (role === 'admin') return n.type === 'announcement' ? '/admin/announcements' : n.type === 'payment_success' ? '/admin/payments' : '/admin/fees';
    if (n.type === 'announcement') return `/${role}/announcements`;
    if (n.type === 'payment_success') return `/${role}/payments`;
    return `/${role}`;
  };
  const open = async (n: Notification) => {
    if (!n.read) {
      setData((d) => d?.map((x) => (x._id === n._id ? { ...x, read: true } : x)) ?? null);
      await api.patch(`/notifications/${n._id}/read`).catch(() => undefined);
      void dispatch(fetchUnread());
    }
    navigate(target(n));
  };
  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); toast.success('All notifications marked as read'); reload(); void dispatch(fetchUnread()); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const unread = (meta?.unreadCount as number) ?? 0;
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up"} actions={unread > 0 && <Button variant="outline" onClick={markAll}><CheckCheck />Mark all as read</Button>} />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}><TabsList className="mb-4"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="unread">Unread</TabsTrigger></TabsList></Tabs>
      <Card>
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <TableSkeleton /> : !data?.length ? (
          <EmptyState icon={Bell} title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Fee reminders, payment confirmations and announcements will appear here." />
        ) : (
          <ul className="divide-y">
            {data.map((n) => {
              const m = ICON[n.type];
              return (
                <li key={n._id}>
                  <button onClick={() => open(n)} className={cn('flex w-full gap-3 px-4 py-4 text-left hover:bg-slate-50 sm:px-5', !n.read && 'bg-indigo-50/40')}>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', m.cls)}><m.icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><span className={cn('text-sm', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</span><span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span></span>
                      <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
