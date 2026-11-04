import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, Info, Search, type LucideIcon } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { STATUS_META, initials } from '@/utils/format';
import type { FeeStatus, PageMeta } from '@/types';

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[13px] font-medium text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const DOT = { success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500', info: 'bg-indigo-500', neutral: 'bg-slate-400' } as const;

export function StatusBadge({ status, className }: { status: FeeStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <Badge variant={m.variant} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[m.variant])} />
      {m.label}
    </Badge>
  );
}

export function Dot({ tone, className }: { tone: keyof typeof DOT; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', DOT[tone], className)} aria-hidden />;
}

/** Brand mark + wordmark. */
export function Logo({ subtitle, compact }: { subtitle?: string; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy" aria-hidden>
        <svg viewBox="0 0 32 32" className="h-8 w-8"><rect x="9" y="10" width="11" height="2.4" rx="1.2" fill="#fff" /><rect x="9" y="14.8" width="8" height="2.4" rx="1.2" fill="#fff" /><rect x="9" y="19.6" width="11" height="2.4" rx="1.2" fill="#fff" /><circle cx="22.5" cy="16" r="1.6" fill="#818cf8" /></svg>
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block text-[15px] font-semibold text-foreground">EduLedger</span>
          {subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </div>
  );
}

/** Small bordered square holding an icon (used in stat tiles and lists). */
export function IconChip({ icon: Icon, tone = 'slate', className }: { icon: LucideIcon; tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'indigo'; className?: string }) {
  const tones = { slate: 'text-slate-600', emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', indigo: 'text-indigo-600' };
  return <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-white', tones[tone], className)}><Icon className="h-3.5 w-3.5" /></span>;
}

/** Paid / pending / overdue proportion bar with 2px gaps between segments. */
export function SegmentedBar({ parts, className }: { parts: { value: number; className: string; label: string }[]; className?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className={cn('flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted', className)} role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
      {parts.filter((p) => p.value > 0).map((p) => <span key={p.label} className={cn('h-full first:rounded-l-full last:rounded-r-full', p.className)} style={{ width: `${(p.value / total) * 100}%` }} />)}
    </div>
  );
}

export function StatCard({ label, value, hint, sub, icon, tone = 'slate', loading, link, info }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; sub?: React.ReactNode; icon: LucideIcon; tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'indigo';
  loading?: boolean; link?: { to: string; label: string }; info?: string;
}) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={icon} tone={tone} />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{label}</p>
        {info && <span title={info} className="text-slate-400"><Info className="h-3.5 w-3.5" aria-label={info} /></span>}
      </div>
      {loading ? <Skeleton className="mt-4 h-8 w-28" /> : <p className="mt-3.5 truncate text-[22px] font-semibold tabular tracking-tight text-foreground sm:text-[26px]">{value}</p>}
      {hint && !loading && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {sub && !loading && <div className="mt-2.5 text-xs text-slate-700">{sub}</div>}
      {link && !loading && <Link to={link.to} className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{link.label}<ArrowRight className="h-3 w-3" /></Link>}
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

function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const arr = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
}

export function Pagination({ meta, onPage, noun = 'records' }: { meta: PageMeta | null; onPage: (p: number) => void; noun?: string }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex flex-col gap-3 border-t px-5 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="tabular">Showing <span className="font-medium text-foreground">{from}–{to}</span> of <span className="font-medium text-foreground">{meta.total}</span> {noun}</span>
      {meta.totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          {pageList(meta.page, meta.totalPages).map((p, i) => p === '…'
            ? <span key={`e${i}`} className="px-1.5">…</span>
            : <button key={p} onClick={() => onPage(p)} aria-current={p === meta.page ? 'page' : undefined}
                className={cn('h-8 min-w-8 rounded-md px-2 text-[13px] font-medium tabular', p === meta.page ? 'bg-navy text-white' : 'text-slate-700 hover:bg-muted')}>{p}</button>)}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page"><ChevronRight /></Button>
        </nav>
      )}
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
  const palette = ['bg-indigo-50 text-indigo-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-800', 'bg-sky-50 text-sky-700', 'bg-rose-50 text-rose-700', 'bg-violet-50 text-violet-700'];
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-black/[0.04]', palette[idx], className)} aria-hidden>{initials(name)}</div>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#eceef4]', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${v}%` }} />
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
