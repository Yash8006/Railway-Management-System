import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchTrains } from '../api/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

// Helper: today's date in YYYY-MM-DD
const today = () => new Date().toISOString().split('T')[0];

export default function HomePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    from: '',
    to: '',
    date: today(),
    classType: '',
    trainType: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSwap = () =>
    setForm((p) => ({ ...p, from: p.to, to: p.from }));

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!form.from || !form.to || !form.date) {
      addToast('Please fill From, To and Date', 'warning');
      return;
    }
    if (form.from.toUpperCase() === form.to.toUpperCase()) {
      addToast('Source and destination cannot be the same', 'warning');
      return;
    }
    setLoading(true);
    try {
      const params = {
        from: form.from.toUpperCase(),
        to: form.to.toUpperCase(),
        date: form.date,
      };
      if (form.classType) params.classType = form.classType;
      if (form.trainType) params.trainType = form.trainType;

      const res = await searchTrains(params);
      navigate('/search-results', {
        state: { results: res.data.data || res.data, searchParams: form },
      });
    } catch (err) {
      addToast(err.response?.data?.message || 'Search failed. Check station codes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickSearches = [
    { from: 'NDLS', to: 'BCT', label: 'Delhi → Mumbai' },
    { from: 'NDLS', to: 'MAS', label: 'Delhi → Chennai' },
    { from: 'HWH', to: 'NDLS', label: 'Kolkata → Delhi' },
    { from: 'BCT', to: 'BNC', label: 'Mumbai → Bangalore' },
  ];

  const features = [
    { icon: '⚡', title: 'Instant Booking', desc: 'ACID-compliant transactions prevent double-booking' },
    { icon: '📡', title: 'Live Tracking', desc: 'Real-time train position, delay alerts & platform numbers' },
    { icon: '🗺️', title: 'Journey Planner', desc: 'Smart connected routes when no direct trains exist' },
    { icon: '💰', title: 'RMS Wallet', desc: 'Instant refunds to your in-app wallet on cancellation' },
    { icon: '🎫', title: 'PDF Tickets', desc: 'Download Electronic Reservation Slips instantly' },
    { icon: '🔔', title: 'Smart Alerts', desc: 'SMS, email & in-app alerts for delays and WL upgrades' },
  ];

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-bg-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        <div className="hero-content">
          {user && (
            <div className="hero-greeting">
              <span className="badge badge-green">🟢 Logged In</span>
              <span className="text-muted">Welcome back, <strong>{user.name}</strong></span>
            </div>
          )}

          <h1 className="hero-title">
            Book Smarter.<br />
            Travel <span className="gradient-text">Faster</span>.
          </h1>
          <p className="hero-subtitle">
            India&apos;s most advanced railway management platform. Search trains, book tickets, and track live status — all in one place.
          </p>

          {/* Search Card */}
          <div className="search-card">
            <form onSubmit={handleSearch}>
              <div className="search-row">
                <div className="search-input-group">
                  <label className="search-label">FROM</label>
                  <input
                    name="from"
                    className="form-input search-input"
                    placeholder="Station code (e.g. NDLS)"
                    value={form.from}
                    onChange={handleChange}
                    required
                  />
                </div>

                <button type="button" className="swap-btn" onClick={handleSwap} title="Swap stations">
                  ⇆
                </button>

                <div className="search-input-group">
                  <label className="search-label">TO</label>
                  <input
                    name="to"
                    className="form-input search-input"
                    placeholder="Station code (e.g. BCT)"
                    value={form.to}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="search-input-group">
                  <label className="search-label">DATE</label>
                  <input
                    name="date"
                    type="date"
                    className="form-input search-input"
                    value={form.date}
                    onChange={handleChange}
                    min={today()}
                    required
                  />
                </div>

                <div className="search-input-group">
                  <label className="search-label">CLASS</label>
                  <select name="classType" className="form-select search-input" value={form.classType} onChange={handleChange}>
                    <option value="">All Classes</option>
                    <option value="Sleeper">Sleeper (SL)</option>
                    <option value="AC 3 Tier">AC 3 Tier (3A)</option>
                    <option value="AC 2 Tier">AC 2 Tier (2A)</option>
                    <option value="First Class">First Class (1A)</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-orange btn-lg search-btn" disabled={loading}>
                {loading ? <><span className="spinner" /> Searching...</> : '🔍 Search Trains'}
              </button>
            </form>

            {/* Quick searches */}
            <div className="quick-searches">
              <span className="quick-label">Popular routes:</span>
              {quickSearches.map((q, i) => (
                <button
                  key={i}
                  className="quick-chip"
                  onClick={() => setForm((p) => ({ ...p, from: q.from, to: q.to }))}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="features-container">
          <div className="section-header" style={{ flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <h2 className="section-title" style={{ fontSize: '1.75rem' }}>Everything you need</h2>
            <p className="text-muted text-center">A production-grade railway platform with enterprise features</p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="stats-section">
        <div className="stats-container">
          {[
            { value: '500+', label: 'Active Trains', icon: '🚂' },
            { value: '1,200+', label: 'Train Routes', icon: '🗺️' },
            { value: '99.9%', label: 'Uptime SLA', icon: '⚡' },
            { value: '0', label: 'Double Bookings', icon: '🔒' },
          ].map((s, i) => (
            <div key={i} className="stats-item">
              <div className="stats-icon">{s.icon}</div>
              <div className="stats-value">{s.value}</div>
              <div className="stats-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
