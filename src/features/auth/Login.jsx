import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form, isRegistering);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '72px auto', padding: 24 }}>
      <h1>Welcome to SyncSpace</h1>
      <p>{isRegistering ? 'Create your mock account.' : 'Sign in to your workspace.'}</p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }} noValidate>
        {isRegistering && <label>Name<input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
        <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p role="alert" style={{ color: '#b42318', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait...' : isRegistering ? 'Create account' : 'Login'}</button>
      </form>
      <button type="button" onClick={() => { setIsRegistering((value) => !value); setError(''); }} style={{ marginTop: 16 }}>
        {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
      </button>
      <p><Link to="/">Back to home</Link></p>
    </main>
  );
}
