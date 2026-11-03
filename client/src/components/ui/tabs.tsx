import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...p }, ref) => <TabsPrimitive.List ref={ref} className={cn('inline-flex h-9 items-center rounded-lg bg-slate-100 p-1 text-slate-500 max-w-full overflow-x-auto', className)} {...p} />,
);
TabsList.displayName = 'TabsList';
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...p }, ref) => (
    <TabsPrimitive.Trigger ref={ref} className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm', className)} {...p} />
  ),
);
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = TabsPrimitive.Content;
