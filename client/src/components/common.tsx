import * as React from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { STATUS_META, initials } from '@/utils/format';
import type { FeeStatus, PageMeta } from '@/types';

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: FeeStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <Badge variant={m.variant} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', {
        'bg-emerald-500': m.variant === 'success', 'bg-amber-500': m.variant === 'warning', 'bg-red-500': m.variant === 'danger',
        'bg-sky-500': m.variant === 'info', 'bg-slate-400': m.variant === 'neutral',
      })} />
      {m.label}
    </Badge>
  );
}

const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  sky: 'bg-sky-50 text-sky-600',
  slate: 'bg-slate-100 text-slate-600',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'indigo', loading }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon; tone?: keyof typeof TONES; loading?: boolean }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-1.5 truncate text-xl font-semibold tabular text-slate-900 sm:text-2xl">{value}</p>}
          {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-500" />
      <p className="text-sm text-slate-700">{message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, j) => <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-40' : 'flex-1')} />)}
        </div>
      ))}
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta: PageMeta | null; onPage: (p: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular">{from}–{to} of {meta.total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="px-2 tabular">{meta.page} / {meta.totalPages}</span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder ?? 'Search'} />
    </div>
  );
}

export function Field({ label, htmlFor, error, hint, children, className, required }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const palette = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700'];
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', palette[idx], className)} aria-hidden>{initials(name)}</div>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', v >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${v}%` }} />
    </div>
  );
}

export function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
