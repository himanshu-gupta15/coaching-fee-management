import type { FeeStatus, PaymentMethod } from '@/types';

/** Amounts arrive from the API as integer paise. */
export function inr(paise: number | undefined | null, opts: { compact?: boolean; decimals?: boolean } = {}) {
  const r = (paise ?? 0) / 100;
  if (opts.compact && Math.abs(r) >= 100000) {
    return `₹${(r / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L`;
  }
  const hasPaise = (paise ?? 0) % 100 !== 0;
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: opts.decimals || hasPaise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Convert a user-entered rupee string ("1,250.50") to integer paise without float drift. */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
export const paiseToRupeeInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

const TZ = 'Asia/Kolkata';
export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '—';
export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '—';
/** YYYY-MM-DD for <input type=date> in institute time zone */
export const isoDay = (d: string | Date = new Date()) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);
export const currentPeriod = () => isoDay().slice(0, 7);

export function relativeDays(d: string | Date) {
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
export function timeAgo(d: string | Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
}

export const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  paid: { label: 'Paid', variant: 'success' },
  partial: { label: 'Partially paid', variant: 'info' },
  pending: { label: 'Pending', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  online_manual: 'Online (manual entry)',
};
export const FREQ_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', one_time: 'One-time' } as const;

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
