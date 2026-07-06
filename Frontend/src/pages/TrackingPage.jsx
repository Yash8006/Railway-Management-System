import { useState } from 'react';
import { getScheduledRuns } from '../api/api.js';
import { useToast } from '../context/ToastContext';

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'badge-gray', icon: '⏸' },
  running: { label: 'On Time', color: 'badge-green', icon: '🚂' },
  reached: { label: 'Arrived', color: 'badge-blue', icon: '🏁' },
  cancelled: { label: 'Cancelled', color: 'badge-red', icon: '❌' },
  diverted: { label: 'Diverted', color: 'badge-amber', icon: '🔀' },
};

export default function TrackingPage() {
  const { addToast } = useToast();
  const [searchNum, setSearchNum] = useState('');
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSelectedRun(null);
    try {
      const res = await getScheduledRuns();
      const data = res.data.data || [];
      // Filter by train number and date
      const filtered = data.filter((r) => {
        const matchTrain = !searchNum || r.train?.trainNumber?.includes(searchNum.toUpperCase());
        const runDate = new Date(r.date).toISOString().split('T')[0];
        const matchDate = !searchDate || runDate === searchDate;
        return matchTrain && matchDate;
      });
      setRuns(filtered);
      if (filtered.length === 0) addToast('No scheduled runs found for the given criteria', 'info');
    } catch (err) {
      addToast(err.response?.data?.message || 'Search failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">📡 Live Train Tracking</h1>
        <p className="page-subtitle">Track live running status, platform numbers, and delay information</p>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 'var(--sp-xl)' }}>
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">🚂 Train Number</label>
              <input className="form-input" placeholder="e.g. 12301 (leave blank for all)" value={searchNum} onChange={(e) => setSearchNum(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">📅 Journey Date</label>
              <input className="form-input" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--sp-md)' }} disabled={loading}>
            {loading ? <><span className="spinner" /> Searching...</> : '🔍 Track Trains'}
          </button>
        </form>
      </div>

      {/* Results */}
      {runs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedRun ? '300px 1fr' : '1fr', gap: 'var(--sp-lg)' }}>
          {/* Run List */}
          <div className="flex flex-col gap-sm">
            {runs.map((run) => {
              const sc = STATUS_CONFIG[run.liveStatus?.status || 'not_started'] || STATUS_CONFIG.not_started;
              return (
                <div
                  key={run._id}
                  className={`card tracking-run-card ${selectedRun?._id === run._id ? 'selected' : ''}`}
                  onClick={() => setSelectedRun(selectedRun?._id === run._id ? null : run)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--clr-primary)' }}>
                        {run.train?.trainNumber}
                      </div>
                      <div style={{ fontWeight: 700 }}>{run.train?.trainName}</div>
                    </div>
                    <span className={`badge ${sc.color}`}>{sc.icon} {sc.label}</span>
                  </div>
                  <div className="text-sm text-muted" style={{ marginTop: 'var(--sp-sm)' }}>
                    📅 {new Date(run.date).toDateString()} &nbsp;·&nbsp; {run.seats?.length || 0} seats
                  </div>
                  {run.liveStatus?.delayMinutes > 0 && (
                    <div className="badge badge-red" style={{ marginTop: 'var(--sp-xs)', display: 'inline-flex' }}>
                      ⏰ Late by {run.liveStatus.delayMinutes} mins
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail Panel */}
          {selectedRun && (
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-lg)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--clr-primary)' }}>{selectedRun.train?.trainNumber}</div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedRun.train?.trainName}</h2>
                </div>
                <button className="modal-close" onClick={() => setSelectedRun(null)}>✕</button>
              </div>

              {selectedRun.liveStatus ? (
                <>
                  <div className="grid-3" style={{ gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
                    <div className="stat-card">
                      <div className="stat-label">Status</div>
                      <div className="stat-value" style={{ fontSize: '1.25rem' }}>{STATUS_CONFIG[selectedRun.liveStatus.status]?.label}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Delay</div>
                      <div className="stat-value" style={{ fontSize: '1.25rem', color: selectedRun.liveStatus.delayMinutes > 0 ? 'var(--clr-red)' : 'var(--clr-green)' }}>
                        {selectedRun.liveStatus.delayMinutes > 0 ? `+${selectedRun.liveStatus.delayMinutes} min` : 'On Time'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Current Stop</div>
                      <div className="stat-value" style={{ fontSize: '1.25rem' }}>{selectedRun.liveStatus.currentStopOrder || '—'}</div>
                    </div>
                  </div>

                  {selectedRun.liveStatus.emergencyAlerts?.length > 0 && (
                    <div className="warning-box" style={{ marginBottom: 'var(--sp-md)' }}>
                      🚨 {selectedRun.liveStatus.emergencyAlerts.join(' · ')}
                    </div>
                  )}

                  {selectedRun.liveStatus.platformNumbers?.length > 0 && (
                    <div style={{ marginBottom: 'var(--sp-md)' }}>
                      <h3 className="section-title" style={{ marginBottom: 'var(--sp-sm)' }}>Platform Numbers</h3>
                      <div className="flex gap-sm flex-wrap">
                        {selectedRun.liveStatus.platformNumbers.map((p, i) => (
                          <span key={i} className="badge badge-blue">Pf. {p.platform}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="info-box">
                  ℹ️ Live status has not been updated yet for this run. Station master updates are pending.
                </div>
              )}

              <div style={{ marginTop: 'var(--sp-lg)' }}>
                <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>Seat Summary</h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>
                  Total seats: <strong>{selectedRun.seats?.length}</strong> &nbsp;·&nbsp;
                  Booked: <strong>{selectedRun.seats?.filter((s) => s.bookedSegments?.length > 0).length}</strong> &nbsp;·&nbsp;
                  Available: <strong className="text-green">{selectedRun.seats?.filter((s) => s.bookedSegments?.length === 0).length}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!runs.length && !loading && (
        <div className="empty-state">
          <span className="empty-state-icon">📡</span>
          <h3>Search for train status</h3>
          <p>Enter a train number and date above to track live running status.</p>
        </div>
      )}
    </div>
  );
}
