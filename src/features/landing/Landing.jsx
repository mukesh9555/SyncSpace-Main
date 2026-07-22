import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../shared/utils/api';

export default function Landing() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState({ loading: false, message: '', error: false });
  async function submit(event) {
    event.preventDefault();
    setStatus({ loading: true, message: '', error: false });
    try {
      const result = await apiRequest('/api/contact', { method: 'POST', body: JSON.stringify(form) });
      setStatus({ loading: false, message: result.message, error: false });
      setForm({ name: '', email: '', message: '' });
    } catch (error) { setStatus({ loading: false, message: error.message, error: true }); }
  }
  return <main style={{ maxWidth: 760, margin: '56px auto', padding: 24 }}>
    <h1>SyncSpace</h1><p>A lightweight shared workspace for notes and whiteboards.</p>
    <p><Link to="/login">Login or create an account</Link></p>
    <section><h2>Contact us</h2><form onSubmit={submit} style={{ display: 'grid', gap: 10 }} noValidate>
      <input aria-label="Name" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input aria-label="Email" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <textarea aria-label="Message" placeholder="How can we help?" required minLength="10" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <button disabled={status.loading}>{status.loading ? 'Sending...' : 'Send message'}</button>
      {status.message && <p role={status.error ? 'alert' : 'status'}>{status.message}</p>}
    </form></section>
  </main>;
}
