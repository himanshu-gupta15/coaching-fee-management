import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/common';
import { api, errMsg } from '@/services/api';
import type { Announcement } from '@/types';

const schema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(160),
  body: z.string().trim().min(3, 'Write a message').max(4000),
  audience: z.enum(['all', 'parents', 'students']),
  pinned: z.boolean(),
});
type V = z.infer<typeof schema>;

export function AnnouncementDialog({ open, onOpenChange, item, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; item?: Announcement | null; onSaved?: () => void }) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) });
  useEffect(() => { if (open) reset({ title: item?.title ?? '', body: item?.body ?? '', audience: item?.audience ?? 'all', pinned: item?.pinned ?? false }); }, [open, item, reset]);
  const onSubmit = async (v: V) => {
    try {
      if (item) await api.patch(`/announcements/${item._id}`, v);
      else await api.post('/announcements', v);
      toast.success(item ? 'Announcement updated' : 'Announcement posted', { description: item ? undefined : 'Recipients have been notified in-app.' });
      onSaved?.();
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit announcement' : 'New announcement'}</DialogTitle><DialogDescription>Shown in the parent and student portals.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="Title" htmlFor="a-title" error={errors.title?.message} required><Input id="a-title" {...register('title')} /></Field>
          <Field label="Message" htmlFor="a-body" error={errors.body?.message} required><Textarea id="a-body" rows={5} {...register('body')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience" htmlFor="a-aud">
              <Controller control={control} name="audience" render={({ field }) => (
                <Select id="a-aud" value={field.value} onValueChange={field.onChange} options={[{ value: 'all', label: 'Parents & students' }, { value: 'parents', label: 'Parents only' }, { value: 'students', label: 'Students only' }]} />
              )} />
            </Field>
            <label className="flex items-center justify-between self-end rounded-lg border p-2 px-3 text-sm font-medium">
              Pin to top
              <Controller control={control} name="pinned" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Pin to top" />} />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{item ? 'Save' : 'Post announcement'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
