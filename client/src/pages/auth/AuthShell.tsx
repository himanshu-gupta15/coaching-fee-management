import type { ReactNode } from 'react';
import { Logo } from '@/components/common';

/** Decorative ledger illustration for the brand panel. */
function LedgerArt() {
  const rows = [['#22c55e', 110, 54], ['#22c55e', 86, 48], ['#f59e0b', 120, 58], ['#475079', 72, 44]] as const;
  return (
    <svg viewBox="0 0 440 360" className="h-auto w-full max-w-[420px]" aria-hidden="true">
      <defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#33395a" /></pattern></defs>
      <rect x="0" y="20" width="440" height="330" fill="url(#dots)" />
      <rect x="92" y="74" width="270" height="250" rx="14" fill="#232a44" stroke="#323a5c" transform="rotate(-4 227 199)" />
      <rect x="80" y="70" width="270" height="250" rx="14" fill="#1f2640" stroke="#353e63" />
      <rect x="102" y="94" width="28" height="28" rx="6" fill="#5b5bf0" />
      <rect x="142" y="99" width="96" height="7" rx="3.5" fill="#c9cde0" />
      <rect x="142" y="112" width="60" height="5" rx="2.5" fill="#5c6386" />
      {rows.map(([c, w, w2], i) => (
        <g key={i} transform={`translate(0 ${145 + i * 34})`}>
          <line x1="102" x2="328" y1="-9" y2="-9" stroke="#2f3756" />
          <circle cx="108" cy="8" r="5" fill={c} />
          <rect x="124" y="5" width={w} height="6" rx="3" fill="#5c6386" />
          <rect x={328 - w2} y="5" width={w2} height="6" rx="3" fill="#c9cde0" />
        </g>
      ))}
      <rect x="102" y="292" width="54" height="7" rx="3.5" fill="#3d4566" />
      <rect x="250" y="290" width="78" height="11" rx="5.5" fill="#7c83f6" />
      <g transform="translate(272 38)">
        <rect width="128" height="56" rx="10" fill="#ffffff" />
        <circle cx="26" cy="28" r="11" fill="#dcfce7" />
        <path d="M21 28.5l3.5 3.5 6.5-7" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="46" y="20" width="62" height="6" rx="3" fill="#1b2033" />
        <rect x="46" y="32" width="40" height="5" rx="2.5" fill="#c9cde0" />
      </g>
    </svg>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px] animate-in">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EduLedger · Fee management for coaching institutes</p>
      </div>
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy px-12 py-16 text-white lg:flex">
        <div className="flex flex-1 items-center justify-center"><LedgerArt /></div>
        <div className="max-w-md">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-300">For coaching institutes</p>
          <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">Every fee, payment and receipt — accounted for.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">Balances are calculated on the server, partial payments are tracked to the rupee, and parents see exactly what's due.</p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-sm">
            <div><dt className="text-slate-400">Receipts</dt><dd className="mt-1 font-medium">PDF, instant</dd></div>
            <div><dt className="text-slate-400">Access</dt><dd className="mt-1 font-medium">Role-based</dd></div>
            <div><dt className="text-slate-400">History</dt><dd className="mt-1 font-medium">Full audit log</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
