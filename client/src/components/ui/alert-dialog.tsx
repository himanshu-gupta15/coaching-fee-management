import * as React from 'react';
import * as AD from '@radix-ui/react-alert-dialog';
import { Button } from './button';

interface ConfirmProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

/** Confirmation dialog used before destructive or financial actions. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive, loading, onConfirm, children }: ConfirmProps) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-slate-900/40 data-[state=open]:animate-in" />
        <AD.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl data-[state=open]:animate-in">
          <AD.Title className="text-lg font-semibold">{title}</AD.Title>
          <AD.Description asChild>
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          </AD.Description>
          {children}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel asChild>
              <Button variant="outline" disabled={loading}>Cancel</Button>
            </AD.Cancel>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              loading={loading}
              onClick={async (e) => {
                e.preventDefault();
                await onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
