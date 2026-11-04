import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr } from '@/utils/format';
import type { MonthlyPoint } from '@/types';

/** Validated categorical slots (see dataviz validator): indigo, teal, amber. */
export const SERIES = { s1: '#4f46e5', s2: '#0ea5a4', s3: '#f59e0b', ref: '#cbd5e1' };
const axis = { fontSize: 12, fill: '#64748b' };
/** Axis ticks: ₹0, ₹7k, ₹75k, ₹1.2L (paise in). */
export function axisINR(paise: number) {
  const r = paise / 100;
  if (r >= 100000) return `₹${+(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${+(r / 1000).toFixed(1)}k`;
  return `₹${r}`;
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}
          <span className="ml-auto pl-4 font-semibold tabular text-slate-900">{inr(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      {items.map((i) => <span key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>)}
    </div>
  );
}

/** Billed vs collected per month — grouped bars on one axis. */
export function CollectionChart({ data, height = 260, showBilled = true }: { data: MonthlyPoint[]; height?: number; showBilled?: boolean }) {
  return (
    <div style={{ height }} role="img" aria-label="Monthly fee collection chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} tickFormatter={(v: string) => v.split(' ')[0]} />
          <YAxis tickLine={false} axisLine={false} tick={axis} width={52} tickFormatter={axisINR} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
          {showBilled && <Bar dataKey="billed" name="Billed" fill={SERIES.ref} radius={[4, 4, 0, 0]} maxBarSize={28} />}
          <Bar dataKey="collected" name="Collected" fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Collected by payment method per month — stacked, with 2px surface gaps. */
export function MethodChart({ data, height = 260 }: { data: MonthlyPoint[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Collections by payment method">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} tickFormatter={(v: string) => v.split(' ')[0]} />
          <YAxis tickLine={false} axisLine={false} tick={axis} width={52} tickFormatter={axisINR} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="cash" name="Cash" stackId="m" fill={SERIES.s1} stroke="#fff" strokeWidth={2} maxBarSize={32} />
          <Bar dataKey="bank" name="Bank transfer" stackId="m" fill={SERIES.s2} stroke="#fff" strokeWidth={2} maxBarSize={32} />
          <Bar dataKey="online" name="Online (manual)" stackId="m" fill={SERIES.s3} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Collected (area) vs billed (dashed reference line) on one axis. */
export function CollectionAreaChart({ data, height = 260 }: { data: MonthlyPoint[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Collected versus billed per month">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.s1} stopOpacity={0.14} />
              <stop offset="100%" stopColor={SERIES.s1} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axis} tickFormatter={(v: string) => v.split(' ')[0]} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={axis} width={52} tickFormatter={axisINR} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: '#c7cbe0', strokeDasharray: '3 3' }} />
          <Line type="monotone" dataKey="billed" name="Billed" stroke="#9aa1b5" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="collected" name="Collected" stroke={SERIES.s1} strokeWidth={2} fill="url(#collectedFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
