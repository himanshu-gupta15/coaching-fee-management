import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common';
import { api, errMsg } from '@/services/api';
import { AuthShell } from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setSent(data.data.message);
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      {sent ? (
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50"><MailCheck className="h-5 w-5 text-emerald-600" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Request received</h1>
          <p className="mt-2 text-sm text-muted-foreground">{sent}</p>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">This demo has no email service. The institute office can issue you a secure reset link from the admin console.</p>
          <Button asChild variant="outline" className="mt-6 w-full"><Link to="/login">Back to sign in</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the email linked to your account.</p>
          <Field label="Email" htmlFor="fp-email" className="mt-8"><Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          <Button type="submit" className="mt-6 w-full" size="lg" loading={busy} disabled={!email}>Continue</Button>
          <p className="mt-6 text-center text-sm"><Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
