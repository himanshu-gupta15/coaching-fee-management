import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { StudentFeeView, type StudentDetail } from '../shared/StudentFeeView';

export default function StudentHomePage() {
  const { data, error, reload } = useApi<StudentDetail>('/students/me');
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  return <StudentFeeView data={data} />;
}
