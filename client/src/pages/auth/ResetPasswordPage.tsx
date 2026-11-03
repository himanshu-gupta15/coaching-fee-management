import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common';
import { api, errMsg } from '@/services/api';
import { AuthShell } from './AuthShell';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strong = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(pw);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong) return setErr('Use at least 8 characters with a letter and a number.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true); setErr(null);
    try {
      await api.post('/auth/reset-password', { token, password: pw });
      toast.success('Password updated. Please sign in.');
      navigate('/login', { replace: true });
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        {!token && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This link is missing its token. Ask the institute office for a new reset link.</p>}
        <Field label="New password" htmlFor="np" className="mt-8" hint="At least 8 characters with a letter and a number."><Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Confirm password" htmlFor="np2" className="mt-4"><Input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <Button type="submit" className="mt-6 w-full" size="lg" loading={busy} disabled={!token}>Update password</Button>
        <p className="mt-6 text-center text-sm"><Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
      </form>
    </AuthShell>
  );
}
