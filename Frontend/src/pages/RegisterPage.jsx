import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './Auth.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      addToast('Passwords do not match', 'error');
      return;
    }
    if (form.password.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form.name, form.email, form.password);
      addToast(`Welcome to RMS, ${user.name}! 🎉`, 'success');
      navigate('/');
    } catch (err) {
      addToast(err.response?.data?.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const strength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3;
  const strengthColors = ['', '#ef4444', '#f59e0b', '#10b981'];
  const strengthLabels = ['', 'Weak', 'Good', 'Strong'];

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />

      <div className="auth-container">
        {/* Left Hero */}
        <div className="auth-hero">
          <div className="auth-hero-content">
            <div className="auth-logo">🎫</div>
            <h1 className="auth-hero-title">
              Start your journey<br />
              <span className="gradient-text-orange">today</span>
            </h1>
            <p className="auth-hero-desc">
              Create your free RMS account and get access to the most advanced railway ticketing experience in India.
            </p>
            <div className="auth-stats">
              {[
                { value: '500+', label: 'Trains' },
                { value: '1200+', label: 'Routes' },
                { value: '10M+', label: 'Tickets Booked' },
              ].map((s, i) => (
                <div key={i} className="auth-stat">
                  <div className="auth-stat-value">{s.value}</div>
                  <div className="auth-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-box">
            <div className="auth-form-header">
              <h2>Create Account</h2>
              <p>Join millions of travelers on RMS</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">👤 Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Yash Kumar"
                  value={form.name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">📧 Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">🔒 Password</label>
                <input
                  id="reg-password"
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
                {form.password && (
                  <div style={{ marginTop: 6 }}>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(strength / 3) * 100}%`,
                          background: strengthColors[strength]
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: strengthColors[strength], marginTop: 4, display: 'block' }}>
                      {strengthLabels[strength]}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">🔒 Confirm Password</label>
                <input
                  id="reg-confirm"
                  type="password"
                  name="confirm"
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={form.confirm}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn btn-orange btn-lg w-full" disabled={loading}>
                {loading ? <><span className="spinner" /> Creating Account...</> : '🎫 Create Account'}
              </button>
            </form>

            <p className="auth-switch">
              Already have an account?{' '}
              <Link to="/login" className="auth-link">Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
