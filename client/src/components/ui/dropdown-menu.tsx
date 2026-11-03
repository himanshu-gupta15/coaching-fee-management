import * as React from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DM.Content>, React.ComponentPropsWithoutRef<typeof DM.Content>>(
  ({ className, sideOffset = 6, ...p }, ref) => (
    <DM.Portal>
      <DM.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 min-w-[12rem] overflow-hidden rounded-lg border bg-white p-1 shadow-lg data-[state=open]:animate-in', className)} {...p} />
    </DM.Portal>
  ),
);
DropdownMenuContent.displayName = 'DropdownMenuContent';
export const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DM.Item>, React.ComponentPropsWithoutRef<typeof DM.Item> & { destructive?: boolean }>(
  ({ className, destructive, ...p }, ref) => (
    <DM.Item ref={ref} className={cn('flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-slate-100 [&_svg]:size-4', destructive && 'text-destructive data-[highlighted]:bg-red-50', className)} {...p} />
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';
export const DropdownMenuLabel = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)} {...p} />;
export const DropdownMenuSeparator = () => <DM.Separator className="-mx-1 my-1 h-px bg-slate-100" />;
