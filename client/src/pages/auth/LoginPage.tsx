import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, login } from '@/store/authSlice';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type V = z.infer<typeof schema>;

const DEMO = [
  { role: 'Admin', email: 'admin@brightpath.edu', password: 'Admin@123' },
  { role: 'Parent', email: 'rajesh.sharma@example.com', password: 'Parent@123' },
  { role: 'Student', email: 'aarav.sharma@student.example.com', password: 'Student@123' },
];

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const error = useAppSelector((s) => s.auth.error);
  const [show, setShow] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) });
  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const onSubmit = async (v: V) => {
    const r = await dispatch(login(v));
    if (login.fulfilled.match(r)) {
      const from = (location.state as { from?: string } | null)?.from;
      const home = `/${r.payload.role}`;
      navigate(from?.startsWith(home) ? from : home, { replace: true });
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Admins, parents and students use the same sign-in.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" placeholder="you@example.com" {...register('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...register('password')} aria-invalid={!!errors.password} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Sign in</Button>
      </form>
      <div className="mt-8 rounded-xl border border-dashed p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Demo accounts</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <Button key={d.role} type="button" variant="outline" size="sm" onClick={() => { setValue('email', d.email); setValue('password', d.password); }}>{d.role}</Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Fills the form with fake demo credentials.</p>
      </div>
    </AuthShell>
  );
}
