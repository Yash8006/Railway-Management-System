import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './Auth.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      addToast(`Welcome back, ${user.name}! 🎉`, 'success');
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      addToast(err.response?.data?.message || 'Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />

      <div className="auth-container">
        {/* Left Panel */}
        <div className="auth-hero">
          <div className="auth-hero-content">
            <div className="auth-logo">🚂</div>
            <h1 className="auth-hero-title">
              Railway Management<br />
              <span className="gradient-text">System</span>
            </h1>
            <p className="auth-hero-desc">
              Book tickets, track live train status, manage journeys — all in one place. The future of Indian railway ticketing.
            </p>
            <div className="auth-features">
              {[
                { icon: '⚡', text: 'Instant PNR booking with ACID transactions' },
                { icon: '🗺️', text: 'Smart connected journey planner' },
                { icon: '📡', text: 'Live train tracking & delay alerts' },
                { icon: '💰', text: 'In-app RMS Wallet & auto-refunds' },
              ].map((f, i) => (
                <div key={i} className="auth-feature-item">
                  <span className="auth-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel — Form */}
        <div className="auth-form-panel">
          <div className="auth-form-box">
            <div className="auth-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your RMS account</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">📧 Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">🔒 Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="btn btn-orange btn-lg w-full" disabled={loading}>
                {loading ? <><span className="spinner" /> Signing in...</> : '🚂 Sign In'}
              </button>
            </form>

            <p className="auth-switch">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="auth-link">Create one free →</Link>
            </p>

            {/* Demo Credentials */}
            <div className="demo-creds">
              <p className="demo-label">🧪 Demo Credentials</p>
              <div className="demo-grid">
                <button
                  className="demo-btn"
                  onClick={() => { setEmail('admin@rms.com'); setPassword('admin123'); }}
                >
                  <span className="badge badge-orange">Admin</span>
                  <code>admin@rms.com</code>
                </button>
                <button
                  className="demo-btn"
                  onClick={() => { setEmail('user@rms.com'); setPassword('user1234'); }}
                >
                  <span className="badge badge-green">Passenger</span>
                  <code>user@rms.com</code>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
