import { useEffect, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';

export function Login() {
  const { login, signup } = useApp();
  const [mode, setMode] = useState('signin');
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/config').then(setConfig).catch(() => setConfig({ signupEnabled: false }));
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signin') {
        await login(form.email.trim(), form.password);
      } else {
        await signup({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          inviteCode: form.inviteCode.trim(),
        });
      }
    } catch (err) {
      setError(err.status === 0 ? 'Cannot reach the server. Check your connection.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const signingUp = mode === 'signup';

  return (
    <div className="login-shell">
      <div className="card card-pad login-card">
        <div className="row" style={{ marginBottom: '0.75rem' }}>
          <span className="brand-mark" aria-hidden="true">🧭</span>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>No-Degree Tech Roadmap</h1>
        </div>
        <p className="muted small">
          Eleven realistic routes into tech without a degree — what to learn, what it costs, and roughly how long it
          takes. {signingUp ? 'Create an account to start tracking.' : 'Sign in to track where you are.'}
        </p>

        <form onSubmit={submit} style={{ marginTop: '1.25rem' }}>
          {signingUp && (
            <div className="field">
              <label htmlFor="displayName">Your name</label>
              <input id="displayName" value={form.displayName} autoComplete="name" onChange={set('displayName')} />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} autoComplete="username" required onChange={set('email')} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              required
              minLength={signingUp ? 8 : undefined}
              onChange={set('password')}
            />
            {signingUp && <div className="faint">At least 8 characters.</div>}
          </div>

          {signingUp && config?.requiresInvite && (
            <div className="field">
              <label htmlFor="inviteCode">Invite code</label>
              <input id="inviteCode" value={form.inviteCode} required onChange={set('inviteCode')} />
              <div className="faint">Ask whoever sent you here.</div>
            </div>
          )}

          {error && (
            <p className="small" style={{ color: 'var(--danger)', marginTop: '0.75rem' }} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={busy}>
            {busy ? 'Working…' : signingUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {config?.signupEnabled && (
          <p className="small center" style={{ marginTop: '1rem', marginBottom: 0 }}>
            {signingUp ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setMode(signingUp ? 'signin' : 'signup');
                setError('');
              }}
            >
              {signingUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        )}

        {config && !config.signupEnabled && (
          <p className="faint" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
            New accounts are closed on this instance. The seeded accounts are set by the ERIC_PASSWORD and
            MATT_PASSWORD environment variables.
          </p>
        )}
      </div>
    </div>
  );
}
