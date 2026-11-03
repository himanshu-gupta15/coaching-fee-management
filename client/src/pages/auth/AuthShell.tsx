import type { ReactNode } from 'react';
import { BarChart3, ShieldCheck, Users } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700"><svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 21.5 16 9l7 12.5h-4.2L16 16.2l-2.8 5.3Z" fill="#fff" /></svg></div>
          <span className="font-semibold">BrightPath Academy</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Fees, payments and parent updates — in one place.</h2>
          <p className="mt-3 text-slate-400">Track every rupee with accurate balances, instant receipts and a simple portal for parents.</p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><BarChart3 className="h-4 w-4 text-indigo-400" />Live collection and overdue tracking</li>
            <li className="flex items-center gap-3"><Users className="h-4 w-4 text-indigo-400" />Parent portal with receipts and reminders</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-indigo-400" />Role-based access and full audit trail</li>
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm animate-in">{children}</div>
      </div>
    </div>
  );
}
