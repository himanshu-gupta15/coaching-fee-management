import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Option { value: string; label: string }

/** Simple controlled select. Radix disallows "" values, so "all" style options use a sentinel. */
export function Select({
  value, onValueChange, options, placeholder, className, id, disabled, 'aria-label': ariaLabel, invalid,
}: {
  value?: string; onValueChange: (v: string) => void; options: Option[]; placeholder?: string; className?: string; id?: string; disabled?: boolean; 'aria-label'?: string; invalid?: boolean;
}) {
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[placeholder]:text-slate-400 disabled:opacity-50 aria-[invalid=true]:border-destructive',
          className,
        )}
      >
        <span className="truncate"><SelectPrimitive.Value placeholder={placeholder} /></span>
        <SelectPrimitive.Icon><ChevronDown className="h-4 w-4 opacity-50" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={4} className="z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-white shadow-lg data-[state=open]:animate-in">
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-slate-100">
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator><Check className="h-4 w-4 text-primary" /></SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
