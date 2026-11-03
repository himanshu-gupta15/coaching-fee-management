import * as React from 'react';
import { cn } from '@/lib/utils';

export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...p} />
  </div>
);
export const THead = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn('bg-slate-50/80 [&_tr]:border-b', className)} {...p} />;
export const TBody = ({ className, ...p }: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className={cn('[&_tr:last-child]:border-0', className)} {...p} />;
export const TR = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('border-b transition-colors hover:bg-slate-50/60', className)} {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap', className)} {...p} />
);
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-middle', className)} {...p} />;
