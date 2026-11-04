import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, GraduationCap, Loader2, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, login } from '@/store/authSlice';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password'), remember: z.boolean() });
type V = z.infer<typeof schema>;

const DEMO = [
  { role: 'Admin', sub: 'Office console', icon: ShieldCheck, email: 'admin@brightpath.edu', password: 'Admin@123' },
  { role: 'Parent', sub: '2 children', icon: Users, email: 'rajesh.sharma@example.com', password: 'Parent@123' },
  { role: 'Student', sub: 'Own fees', icon: GraduationCap, email: 'aarav.sharma@student.example.com', password: 'Student@123' },
];

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const error = useAppSelector((s) => s.auth.error);
  const [show, setShow] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', remember: true } });
  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const signIn = async (v: V) => {
    const r = await dispatch(login(v));
    if (login.fulfilled.match(r)) {
      const from = (location.state as { from?: string } | null)?.from;
      const home = `/${r.payload.role}`;
      navigate(from?.startsWith(home) ? from : home, { replace: true });
    }
  };
  const demo = async (d: (typeof DEMO)[number]) => {
    setDemoBusy(d.role);
    await signIn({ email: d.email, password: d.password, remember: false });
    setDemoBusy(null);
  };

  return (
    <AuthShell>
      <h1 className="text-[28px] font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Sign in to your institute's fee workspace. Admins, parents and students all sign in here.</p>
      <form onSubmit={handleSubmit(signIn)} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" placeholder="you@example.com" className="h-10" {...register('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="h-10 pr-10" {...register('password')} aria-invalid={!!errors.password} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-input accent-[var(--color-primary)]" {...register('remember')} />Keep me signed in</label>
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting && !demoBusy}>Sign in</Button>
      </form>
      <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />Demo access · sample data<span className="h-px flex-1 bg-border" /></div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {DEMO.map((d) => (
          <button key={d.role} type="button" onClick={() => demo(d)} disabled={!!demoBusy}
            className="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:border-indigo-200 hover:bg-[#fafbff] disabled:opacity-60" aria-label={`Sign in as demo ${d.role.toLowerCase()}`}>
            {demoBusy === d.role ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <d.icon className="h-4 w-4 text-slate-600" />}
            <span className="mt-1 text-sm font-medium">{d.role}</span>
            <span className="text-xs text-muted-foreground">{d.sub}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Signs in with a demo account. All names and contact details are fictional.</p>
    </AuthShell>
  );
}
