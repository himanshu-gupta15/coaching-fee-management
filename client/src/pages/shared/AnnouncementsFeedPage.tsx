import { Megaphone, Pin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { fmtDate } from '@/utils/format';
import type { Announcement } from '@/types';

export default function AnnouncementsFeedPage() {
  const { data, loading, error, reload } = useApi<Announcement[]>('/announcements');
  return (
    <>
      <PageHeader title="Announcements" description="Notices from the institute" />
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Card><TableSkeleton rows={3} cols={1} /></Card> : !data?.length ? (
        <Card><EmptyState icon={Megaphone} title="No announcements" description="Notices from the institute will appear here." /></Card>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a._id} className={a.pinned ? 'border-indigo-200' : ''}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{a.title}</h2>
                  {a.pinned && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary"><Pin className="h-3 w-3" />Pinned</span>}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{a.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">{fmtDate(a.createdAt)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
