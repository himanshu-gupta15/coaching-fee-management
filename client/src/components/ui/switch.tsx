import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export function Switch({ className, ...p }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root className={cn('peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-slate-200 transition-colors data-[state=checked]:bg-primary', className)} {...p}>
      <SwitchPrimitive.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}
