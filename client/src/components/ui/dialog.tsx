import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }
>(({ className, children, wide, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-white shadow-xl focus:outline-none data-[state=open]:animate-in',
        'inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl p-5 pb-safe',
        'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6 sm:w-full',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-1 pr-6', className)} {...p} />
);
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...p} />
);
export const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...p }, ref) => <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold tracking-tight', className)} {...p} />,
);
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...p }, ref) => <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...p} />,
);
DialogDescription.displayName = 'DialogDescription';

/** Left-side drawer used for mobile navigation. */
export function Sheet({ open, onOpenChange, children, title }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; title: string }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 data-[state=open]:animate-in" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar shadow-2xl focus:outline-none data-[state=open]:animate-in">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Navigation menu</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
