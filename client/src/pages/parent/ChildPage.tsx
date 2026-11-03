import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { StudentFeeView, type StudentDetail } from '../shared/StudentFeeView';

export default function ChildPage() {
  const { id } = useParams();
  const { data, error, reload } = useApi<StudentDetail>(`/students/${id}`);
  return (
    <>
      <Link to="/parent" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Home</Link>
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div> : <StudentFeeView data={data} />}
    </>
  );
}
