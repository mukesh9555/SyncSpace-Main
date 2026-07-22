import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Code2, Footprints, Lock, Mail, Sparkles, Users, Zap } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuth } from '../features/auth/context/AuthContext';

function AuthIllustration() {
  return <aside className="relative hidden min-h-screen overflow-hidden bg-slate-50 p-10 lg:block lg:w-3/5 xl:p-16">
    <div className="absolute -right-10 -top-10 h-80 w-80 rounded-full bg-blue-200/60 blur-3xl" /><div className="absolute -bottom-8 -left-8 h-64 w-64 rounded-full bg-violet-200/70 blur-3xl" />
    <div className="relative mx-auto flex h-full max-w-3xl items-center"><Card className="w-full bg-white/75 p-8 backdrop-blur-xl xl:p-10"><div className="flex items-center gap-3 border-b border-sync-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-xl border border-sync-border bg-sync-bg"><Footprints className="h-6 w-6 text-sync-primary" /></span><div><p className="text-lg font-semibold">Product development workspace</p><p className="mt-1 text-sm text-sync-text-secondary">Workspace sync: <span className="font-semibold text-sync-success">Active</span></p></div></div>
      <div className="mt-8 grid gap-5 rounded-xl border border-sync-border bg-slate-50 p-6 font-mono text-sm leading-7 text-slate-600 sm:grid-cols-2"><div><p className="mb-3 font-sans text-xs font-bold uppercase tracking-widest text-sync-text-secondary">Sync state</p><p>StateVector: {'{ alex: 102, maria: 105 }'}</p><p>RoomID: ux-workflow-final</p><p className="text-sync-primary">ClientStatus: CONNECTED</p></div><div className="border-t border-sync-border pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><p className="mb-3 font-sans text-xs font-bold uppercase tracking-widest text-sync-text-secondary">Collaboration activity</p><div className="flex items-center gap-3 font-sans text-sm text-sync-text"><span className="relative h-8 w-8 rounded-full bg-sync-accent"><i className="absolute -inset-1.5 rounded-full bg-sync-accent/30 animate-cursor-ping" /></span>Alex added a node</div><div className="mt-4 flex items-center gap-3 font-sans text-sm text-sync-text"><span className="h-8 w-8 rounded-full bg-sync-primary" />Maria edited server.ts</div></div></div>
      <div className="mt-8 flex gap-3"><span className="inline-flex items-center gap-2 rounded-lg border border-sync-border bg-white px-3 py-2 text-sm"><Code2 className="h-4 w-4 text-sync-success" />Code collaboration</span><span className="inline-flex items-center gap-2 rounded-lg border border-sync-border bg-white px-3 py-2 text-sm"><Users className="h-4 w-4 text-sync-accent" />Live teammates</span></div>
    </Card></div>
  </aside>;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); setSubmitting(true);
    try { await login(form, registering, registering || remember); navigate('/dashboard'); }
    catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  function social(provider) { setNotice(`${provider} sign-in is a UI placeholder in this mock build.`); }
  function toggleMode() { setRegistering((value) => !value); setError(''); setNotice(''); }

  return <div className="flex min-h-screen bg-sync-bg"><AuthIllustration /><main className="flex w-full items-center justify-center p-5 sm:p-8 lg:w-2/5 lg:p-10"><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="w-full max-w-md"><Card className="p-7 sm:p-10"><div className="text-center"><Link to="/" className="inline-flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sync-primary shadow-sm"><Zap className="h-6 w-6 fill-white text-white" /></span><span className="text-3xl font-extrabold tracking-tight">SyncSpace</span></Link><h1 className="mt-7 text-3xl font-bold tracking-tight">{registering ? 'Create your account' : 'Welcome back'}</h1><p className="mt-2 text-sync-text-secondary">{registering ? 'Start collaborating with your team today.' : 'Continue to your collaborative workspace.'}</p></div>
        <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>{registering && <Input label="Full name" placeholder="Alex Johnson" value={form.name} onChange={update('name')} minLength="2" required />}<Input label="Email address" icon={Mail} type="email" placeholder="you@company.com" value={form.email} onChange={update('email')} required /><Input label="Password" icon={Lock} type="password" placeholder="At least 6 characters" value={form.password} onChange={update('password')} minLength="6" required />
          {!registering && <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-sync-text-secondary"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-sync-border text-sync-primary focus:ring-sync-primary" />Remember me</label><button type="button" onClick={() => setNotice('Password recovery is not available in the mock API yet.')} className="font-semibold text-sync-primary hover:underline">Forgot password?</button></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-sync-primary">{notice}</p>}
          <Button type="submit" icon={Zap} className="w-full rounded-xl py-3.5" disabled={submitting}>{submitting ? 'Please wait...' : registering ? 'Create SyncSpace account' : 'Sign in with SyncSpace'}</Button>
        </form>
        <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-sync-border" />or continue with<span className="h-px flex-1 bg-sync-border" /></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => social('GitHub')} className="rounded-xl border border-sync-border bg-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-50">GitHub</button><button type="button" onClick={() => social('Google')} className="rounded-xl border border-sync-border bg-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-50">Google</button></div>
        <p className="mt-7 text-center text-sm text-sync-text-secondary">{registering ? 'Already have an account?' : "Don't have an account?"} <button type="button" onClick={toggleMode} className="font-semibold text-sync-accent hover:underline">{registering ? 'Sign in' : 'Register for free'}</button></p>
      </Card><p className="mt-5 text-center text-xs text-sync-text-secondary"><Sparkles className="mr-1 inline h-3.5 w-3.5" />Mock authentication for the SyncSpace demo</p></motion.div></main></div>;
}
