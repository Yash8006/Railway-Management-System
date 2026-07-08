import { useState } from 'react';
import { getTrainLiveStatus } from '../api/api.js';
import { useToast } from '../context/ToastContext';

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'badge-gray', icon: '⏸' },
  running: { label: 'Running', color: 'badge-green', icon: '🚂' },
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
    if (!searchNum.trim()) {
      addToast('Please enter a Train Number', 'warning');
      return;
    }
    setLoading(true);
    setSelectedRun(null);
    try {
      const res = await getTrainLiveStatus({ trainNumber: searchNum.trim(), date: searchDate });
      if (res.data.success && res.data.data) {
        const runData = res.data.data;
        setRuns([runData]);
        setSelectedRun(runData);
      } else {
        setRuns([]);
        addToast('No running status found for the given criteria', 'info');
      }
    } catch (err) {
      setRuns([]);
      addToast(err.response?.data?.message || 'Search failed. Please verify train number.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">📡 Live Train Tracking</h1>
        <p className="page-subtitle">Track real-time train location, speed, delays, platform numbers, and route coordinates</p>
      </div>

      {/* Search Form */}
      <div className="card" style={{ marginBottom: 'var(--sp-xl)' }}>
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">🚂 Train Number *</label>
              <input 
                className="form-input" 
                placeholder="e.g. 12301" 
                value={searchNum} 
                onChange={(e) => setSearchNum(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">📅 Journey Date *</label>
              <input 
                className="form-input" 
                type="date" 
                value={searchDate} 
                onChange={(e) => setSearchDate(e.target.value)} 
                required 
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--sp-md)' }} disabled={loading}>
            {loading ? <><span className="spinner" /> Tracking...</> : '🔍 Get Live Status'}
          </button>
        </form>
      </div>

      {/* Results Workspace */}
      {runs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedRun ? '320px 1fr' : '1fr', gap: 'var(--sp-lg)' }}>
          
          {/* Run List Sidebar */}
          <div className="flex flex-col gap-sm">
            {runs.map((run, i) => {
              const sc = STATUS_CONFIG[run.overallStatus || 'not_started'] || STATUS_CONFIG.not_started;
              return (
                <div
                  key={i}
                  className={`card tracking-run-card ${selectedRun?.scheduledRunId === run.scheduledRunId ? 'selected' : ''}`}
                  onClick={() => setSelectedRun(selectedRun?.scheduledRunId === run.scheduledRunId ? null : run)}
                  style={{ cursor: 'pointer', border: selectedRun?.scheduledRunId === run.scheduledRunId ? '2px solid var(--clr-primary)' : '1px solid var(--clr-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--clr-primary)', fontWeight: 600 }}>
                        {run.trainNumber}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>{run.trainName}</div>
                    </div>
                    <span className={`badge ${sc.color}`}>{sc.icon} {sc.label}</span>
                  </div>
                  <div className="text-sm text-muted" style={{ marginTop: 'var(--sp-sm)', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                    <span>📅 {new Date(run.date).toDateString()}</span>
                  </div>
                  {run.delayMinutes > 0 ? (
                    <div className="badge badge-red" style={{ marginTop: 'var(--sp-xs)', display: 'inline-flex' }}>
                      ⏰ Late by {run.delayMinutes} mins
                    </div>
                  ) : (
                    <div className="badge badge-green" style={{ marginTop: 'var(--sp-xs)', display: 'inline-flex' }}>
                      ✓ On Time
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Live Tracking Dashboard */}
          {selectedRun && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
              
              {/* Header Info */}
              <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--clr-border)', paddingBottom: 'var(--sp-md)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--clr-primary)', fontWeight: 600 }}>
                    {selectedRun.trainNumber} · {selectedRun.trainType}
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedRun.trainName}</h2>
                </div>
                <button className="btn btn-ghost" onClick={() => setSelectedRun(null)} style={{ padding: '4px 10px' }}>✕ Close</button>
              </div>

              {/* Real-time Telemetry Panel */}
              <div className="grid-3" style={{ gap: 'var(--sp-md)' }}>
                <div className="stat-card" style={{ background: 'var(--clr-surface-2)', padding: 'var(--sp-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', textTransform: 'uppercase' }}>⚡ Current Speed</span>
                  <span className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800, color: selectedRun.currentSpeed > 0 ? 'var(--clr-green)' : 'var(--clr-text-muted)' }}>
                    🏎️ {selectedRun.currentSpeed} km/h
                  </span>
                </div>

                <div className="stat-card" style={{ background: 'var(--clr-surface-2)', padding: 'var(--sp-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', textTransform: 'uppercase' }}>📍 Live GPS Position</span>
                  <span className="stat-value" style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                    🧭 {selectedRun.currentCoordinates ? `${selectedRun.currentCoordinates.latitude.toFixed(4)}° N, ${selectedRun.currentCoordinates.longitude.toFixed(4)}° E` : 'Not Available'}
                  </span>
                </div>

                <div className="stat-card" style={{ background: 'var(--clr-surface-2)', padding: 'var(--sp-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', textTransform: 'uppercase' }}>⏱️ Status & Delay</span>
                  <span className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: selectedRun.delayMinutes > 0 ? 'var(--clr-red)' : 'var(--clr-green)' }}>
                    {selectedRun.delayText}
                  </span>
                </div>
              </div>

              {/* Status Alert Box */}
              {selectedRun.etaText && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: 'var(--sp-md)', borderRadius: 'var(--radius-md)', color: 'var(--clr-text)' }}>
                  📢 <strong>Status Broadcast:</strong> {selectedRun.etaText}
                </div>
              )}

              {selectedRun.emergencyAlerts?.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 'var(--sp-md)', borderRadius: 'var(--radius-md)', color: 'var(--clr-red)' }}>
                  🚨 <strong>Emergency Alert:</strong> {selectedRun.emergencyAlerts.join(' · ')}
                </div>
              )}

              {/* Vertical Stops Timeline */}
              <div style={{ marginTop: 'var(--sp-sm)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--sp-lg)' }}>🗺️ Route Geometry & Stations Timeline</h3>
                
                <div className="stops-timeline" style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px' }}>
                  
                  {/* Timeline Vertical bar */}
                  <div style={{
                    position: 'absolute',
                    left: '7px',
                    top: '12px',
                    bottom: '12px',
                    width: '3px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }} />

                  {selectedRun.stops?.map((stop, index) => {
                    const isCrossed = stop.status === 'crossed';
                    const isCurrent = stop.status === 'current';
                    
                    let nodeColor = 'rgba(255, 255, 255, 0.2)';
                    let nodeSize = '12px';
                    let nodeLeft = '3px';
                    let nodeShadow = 'none';

                    if (isCrossed) {
                      nodeColor = 'var(--clr-green)';
                    } else if (isCurrent) {
                      nodeColor = 'var(--clr-primary)';
                      nodeSize = '16px';
                      nodeLeft = '1px';
                      nodeShadow = '0 0 10px var(--clr-primary)';
                    }

                    return (
                      <div 
                        key={index} 
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          paddingBottom: '24px',
                          position: 'relative'
                        }}
                      >
                        
                        {/* Timeline Node dot */}
                        <div style={{
                          position: 'absolute',
                          left: `-24px`,
                          top: '4px',
                          marginLeft: nodeLeft,
                          width: nodeSize,
                          height: nodeSize,
                          borderRadius: '50%',
                          backgroundColor: nodeColor,
                          boxShadow: nodeShadow,
                          transition: 'all 0.3s ease',
                          zIndex: 2
                        }} />

                        {/* Station details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, paddingRight: 'var(--sp-md)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
                            <strong style={{ fontSize: '1.05rem', color: isCurrent ? 'var(--clr-primary)' : 'var(--clr-text)' }}>
                              {stop.stationName}
                            </strong>
                            <span style={{ 
                              fontFamily: 'var(--font-mono)', 
                              fontSize: '0.8rem', 
                              background: 'var(--clr-surface-2)', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              color: 'var(--clr-text-muted)' 
                            }}>
                              {stop.stationCode}
                            </span>
                            {isCurrent && <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>📍 Current position</span>}
                          </div>
                          
                          <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
                            City: {stop.city} &nbsp;·&nbsp; Distance: {stop.distanceKm} km
                          </div>

                          <div style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '0.75rem', 
                            color: 'var(--clr-text-faint)', 
                            marginTop: '2px'
                          }}>
                            🧭 GPS Coordinates: {stop.coordinates.latitude.toFixed(4)}° N, {stop.coordinates.longitude.toFixed(4)}° E
                          </div>
                        </div>

                        {/* Schedule Times and Platform */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '120px', textAlign: 'right' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--clr-text-muted)' }}>
                            Sched: {stop.scheduled.arrival || stop.scheduled.departure}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedRun.delayMinutes > 0 ? 'var(--clr-red)' : 'var(--clr-green)' }}>
                            Est: {stop.estimated.arrival || stop.estimated.departure}
                          </span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            color: 'var(--clr-primary)', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            marginTop: '4px', 
                            fontWeight: 600 
                          }}>
                            Platform {stop.platform}
                          </span>
                        </div>

                      </div>
                    );
                  })}
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
          <p>Enter a train number (e.g. 12301) and journey date to retrieve live coordinates and ETAs.</p>
        </div>
      )}
    </div>
  );
}
