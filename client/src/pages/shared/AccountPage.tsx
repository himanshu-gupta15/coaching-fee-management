import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Field, KV, PageHeader } from '@/components/common';
import { api, errMsg, tokenStore } from '@/services/api';
import { useAppSelector } from '@/store';
import { fmtDateTime } from '@/utils/format';

const schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, 'At least 8 characters with a letter and a number'),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type V = z.infer<typeof schema>;

export default function AccountPage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) });
  const onSubmit = async (v: V) => {
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      tokenStore.set(data.data.token);
      toast.success('Password changed', { description: 'Other sessions have been signed out.' });
      reset({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title="Account" description="Your profile and sign-in settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Contact the institute office to change these details.</CardDescription></CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-3"><Avatar name={user.name} className="h-12 w-12" /><div><p className="font-semibold">{user.name}</p><p className="text-sm capitalize text-muted-foreground">{user.role}</p></div></div>
            <dl className="divide-y"><KV label="Email"><span className="break-all">{user.email}</span></KV><KV label="Phone">{user.phone || '—'}</KV><KV label="Last sign-in">{fmtDateTime(user.lastLoginAt)}</KV></dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle><CardDescription>Changing your password signs out your other sessions.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Field label="Current password" htmlFor="cp" error={errors.currentPassword?.message}><Input id="cp" type="password" autoComplete="current-password" {...register('currentPassword')} /></Field>
              <Field label="New password" htmlFor="npw" error={errors.newPassword?.message}><Input id="npw" type="password" autoComplete="new-password" {...register('newPassword')} /></Field>
              <Field label="Confirm new password" htmlFor="cpw" error={errors.confirm?.message}><Input id="cpw" type="password" autoComplete="new-password" {...register('confirm')} /></Field>
              <Button type="submit" loading={isSubmitting}>Update password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
