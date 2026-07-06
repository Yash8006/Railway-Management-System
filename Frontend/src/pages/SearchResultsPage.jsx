import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SearchResultsPage.css';

const CLASS_LABELS = {
  Sleeper: 'SL',
  'AC 3 Tier': '3A',
  'AC 2 Tier': '2A',
  'First Class': '1A',
};

const QUOTA_LABELS = { GN: 'General', TQ: 'Tatkal', LD: 'Ladies', SR: 'Senior Citizen' };

function statusBadge(avail) {
  if (avail === 0) return <span className="badge badge-red">FULL</span>;
  if (avail <= 5) return <span className="badge badge-amber">⚠ {avail} left</span>;
  return <span className="badge badge-green">✓ {avail} avail</span>;
}

export default function SearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { results = [], searchParams = {} } = location.state || {};
  const [filterClass, setFilterClass] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedQuota, setSelectedQuota] = useState('GN');
  const [sortBy, setSortBy] = useState('departure');

  if (!location.state) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <h3>No Search Performed</h3>
          <p>Go back to the home page to search for trains.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>← Back to Search</button>
        </div>
      </div>
    );
  }

  const filtered = results
    .filter((r) => (!filterClass || r.classType === filterClass))
    .filter((r) => (!filterType || r.trainType === filterType))
    .sort((a, b) => {
      if (sortBy === 'departure') return (a.sourceDeparture || '').localeCompare(b.sourceDeparture || '');
      if (sortBy === 'duration') return (a.duration || 0) - (b.duration || 0);
      if (sortBy === 'fare') return (a.fare || 0) - (b.fare || 0);
      return 0;
    });

  const handleBook = (train) => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/booking', { state: { train, searchParams, quota: selectedQuota } });
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="results-header">
        <div>
          <h1 className="page-title">
            {searchParams.from} → {searchParams.to}
          </h1>
          <p className="page-subtitle">
            📅 {new Date(searchParams.date).toDateString()} &nbsp;·&nbsp; {results.length} train{results.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          ← Modify Search
        </button>
      </div>

      <div className="results-layout">
        {/* Sidebar Filters */}
        <aside className="results-sidebar">
          <div className="card">
            <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>🎛 Filters</h3>

            <div className="form-group" style={{ marginBottom: 'var(--sp-md)' }}>
              <label className="form-label">Booking Quota</label>
              <div className="pill-group">
                {Object.entries(QUOTA_LABELS).map(([k, v]) => (
                  <button
                    key={k}
                    className={`pill ${selectedQuota === k ? 'active' : ''}`}
                    onClick={() => setSelectedQuota(k)}
                  >
                    {k === 'TQ' ? '⚡' : ''} {k}
                  </button>
                ))}
              </div>
              <span className="text-faint text-xs" style={{ marginTop: 4 }}>{QUOTA_LABELS[selectedQuota]}</span>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--sp-md)' }}>
              <label className="form-label">Class</label>
              <select className="form-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                <option value="">All Classes</option>
                <option>Sleeper</option>
                <option>AC 3 Tier</option>
                <option>AC 2 Tier</option>
                <option>First Class</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--sp-md)' }}>
              <label className="form-label">Train Type</label>
              <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option>Express</option>
                <option>Superfast</option>
                <option>Passenger</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Sort By</label>
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="departure">Departure Time</option>
                <option value="duration">Duration</option>
                <option value="fare">Fare (Low→High)</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="results-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🚂</span>
              <h3>No trains found</h3>
              <p>Try changing the date, class, or station codes. Make sure to use exact station codes (e.g. NDLS).</p>
            </div>
          ) : (
            filtered.map((train, i) => (
              <TrainCard key={i} train={train} quota={selectedQuota} onBook={() => handleBook(train)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TrainCard({ train, quota, onBook }) {
  const [expanded, setExpanded] = useState(false);

  const classBadge = (cls) => {
    const colors = { Sleeper: 'badge-blue', 'AC 3 Tier': 'badge-green', 'AC 2 Tier': 'badge-purple', 'First Class': 'badge-amber' };
    return <span key={cls} className={`badge ${colors[cls] || 'badge-gray'}`}>{CLASS_LABELS[cls] || cls}</span>;
  };

  const typeColor = { Express: 'badge-blue', Superfast: 'badge-orange', Passenger: 'badge-gray' };

  return (
    <div className="train-card">
      <div className="train-card-main">
        {/* Train Info */}
        <div className="train-info">
          <div className="train-number">{train.trainNumber}</div>
          <div className="train-name">{train.trainName}</div>
          <div className="train-meta">
            <span className={`badge ${typeColor[train.trainType] || 'badge-gray'}`}>{train.trainType}</span>
            {train.classes?.map((c) => classBadge(c))}
          </div>
        </div>

        {/* Journey Timeline */}
        <div className="train-journey">
          <div className="journey-point">
            <div className="journey-time">{train.sourceDeparture || '—'}</div>
            <div className="journey-station">{train.from}</div>
          </div>
          <div className="journey-line">
            <div className="journey-duration">{train.duration || '—'}</div>
            <div className="journey-track">
              <div className="track-line" />
              <span className="track-train">🚂</span>
            </div>
          </div>
          <div className="journey-point">
            <div className="journey-time">{train.destArrival || '—'}</div>
            <div className="journey-station">{train.to}</div>
          </div>
        </div>

        {/* Availability & Book */}
        <div className="train-booking">
          <div className="train-fare">
            <div className="fare-amount">
              ₹{train.fare || '—'}
              {quota === 'TQ' && <span className="fare-tatkal"> +30% Tatkal</span>}
            </div>
            <div className="fare-label">per passenger</div>
          </div>
          <div className="avail-row">
            {train.availability !== undefined ? statusBadge(train.availability) : <span className="badge badge-blue">Check Avail</span>}
          </div>
          <button className="btn btn-orange" onClick={onBook}>
            Book Now →
          </button>
        </div>
      </div>

      {/* Expand stop details */}
      {train.stops && (
        <div className="train-expand">
          <button className="expand-btn" onClick={() => setExpanded((p) => !p)}>
            {expanded ? '▲ Hide Stops' : `▼ Show ${train.stops.length} Stops`}
          </button>
          {expanded && (
            <div className="stops-list">
              {train.stops.map((s, i) => (
                <div key={i} className="stop-item">
                  <div className="stop-order">{s.stopOrder}</div>
                  <div>
                    <div className="stop-name">{s.stationName || s.station}</div>
                    <div className="stop-times">
                      {s.arrivalTime && <span>Arr: {s.arrivalTime}</span>}
                      {s.departureTime && <span>Dep: {s.departureTime}</span>}
                      {s.distanceFromSource !== undefined && <span>📍 {s.distanceFromSource} km</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
