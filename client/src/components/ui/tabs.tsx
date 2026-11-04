import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

/** `pill` = segmented control; `underline` = page-level tabs. */
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: 'pill' | 'underline' }>(
  ({ className, variant = 'pill', ...p }, ref) => (
    <TabsPrimitive.List ref={ref} data-variant={variant}
      className={cn('group/tabs max-w-full overflow-x-auto',
        variant === 'pill' ? 'inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground' : 'flex items-center gap-5 border-b',
        className)} {...p} />
  ),
);
TabsList.displayName = 'TabsList';
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...p }, ref) => (
    <TabsPrimitive.Trigger ref={ref} className={cn(
      'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all',
      'group-data-[variant=pill]/tabs:rounded-md group-data-[variant=pill]/tabs:px-3 group-data-[variant=pill]/tabs:py-1 group-data-[variant=pill]/tabs:data-[state=active]:bg-white group-data-[variant=pill]/tabs:data-[state=active]:text-foreground group-data-[variant=pill]/tabs:data-[state=active]:shadow-sm',
      'group-data-[variant=underline]/tabs:-mb-px group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent group-data-[variant=underline]/tabs:pb-2.5 group-data-[variant=underline]/tabs:text-muted-foreground group-data-[variant=underline]/tabs:data-[state=active]:border-primary group-data-[variant=underline]/tabs:data-[state=active]:text-foreground',
      className)} {...p} />
  ),
);
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = TabsPrimitive.Content;
