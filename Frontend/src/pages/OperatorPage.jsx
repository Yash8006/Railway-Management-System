import { useState, useEffect } from 'react';
import { getScheduledRuns, updateLiveStatus, getStations } from '../api/api.js';
import { useToast } from '../context/ToastContext';

// What: Operator/Station Master dashboard.
// Why: Provides a restricted user interface for Station Masters and Admins to manage active runs and propagate live updates.
// Alternatives: Command-line script, updating direct MongoDB rows manually.
// Why not alternatives: Manual MongoDB edits are prone to user error and bypass model validators and notification hooks.
export default function OperatorPage() {
  const { addToast } = useToast();
  const [runs, setRuns] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchNum, setSearchNum] = useState('');
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRun, setSelectedRun] = useState(null);
  
  // Update Form State
  const [status, setStatus] = useState('not_started');
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [currentStationCode, setCurrentStationCode] = useState('');
  const [alertsInput, setAlertsInput] = useState('');
  const [platformsInput, setPlatformsInput] = useState({}); // stationCode -> platformNumber
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [runsRes, stationsRes] = await Promise.all([
        getScheduledRuns(),
        getStations()
      ]);
      setRuns(runsRes.data.data || []);
      setStations(stationsRes.data.data || []);
    } catch {
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRun = (run) => {
    setSelectedRun(run);
    setStatus(run.liveStatus?.status || 'not_started');
    setDelayMinutes(run.liveStatus?.delayMinutes || 0);
    setCurrentStationCode(run.liveStatus?.currentStation?.code || '');
    setAlertsInput(run.liveStatus?.emergencyAlerts?.join(', ') || '');
    
    // Map existing platform numbers
    const initialPlats = {};
    run.liveStatus?.platformNumbers?.forEach((p) => {
      if (p.station) {
        initialPlats[p.station.code || p.station] = p.platform;
      }
    });
    setPlatformsInput(initialPlats);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedRun) return;
    setSaving(true);
    try {
      // Map emergency alerts array
      const emergencyAlerts = alertsInput
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      // Map platforms list
      const platformNumbers = Object.entries(platformsInput)
        .filter(([_, platform]) => platform !== undefined && platform.trim() !== '')
        .map(([stationCode, platform]) => ({
          stationCode,
          platform
        }));

      const payload = {
        status,
        delayMinutes: Number(delayMinutes),
        currentStationCode,
        emergencyAlerts,
        platformNumbers
      };

      await updateLiveStatus(selectedRun._id, payload);
      addToast('Live status updated! Delay alerts dispatched. 📡', 'success');
      loadData(); // Reload list
      setSelectedRun(null); // Close edit mode
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredRuns = runs.filter((run) => {
    const matchTrain = !searchNum || run.train?.trainNumber?.includes(searchNum.toUpperCase());
    const runDate = new Date(run.date).toISOString().split('T')[0];
    const matchDate = !searchDate || runDate === searchDate;
    return matchTrain && matchDate;
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">📡 Station Master console</h1>
        <p className="page-subtitle">Track and publish real-time delays, platform numbers, and cancellation logs</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRun ? '360px 1fr' : '1fr', gap: 'var(--sp-xl)', alignItems: 'start' }}>
        {/* Left List Pane */}
        <div>
          {/* Search Controls */}
          <div className="card" style={{ marginBottom: 'var(--sp-lg)' }}>
            <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>🔍 Filter Active Runs</h3>
            <div className="form-group" style={{ marginBottom: 'var(--sp-sm)' }}>
              <label className="form-label">Train Number</label>
              <input className="form-input" placeholder="e.g. 12301" value={searchNum} onChange={(e) => setSearchNum(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Journey Date</label>
              <input className="form-input" type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
          </div>

          {/* Runs list */}
          {loading ? (
            <div className="spinner-center"><div className="spinner" /></div>
          ) : filteredRuns.length === 0 ? (
            <div className="empty-state">
              <p>No active scheduled runs found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              {filteredRuns.map((run) => (
                <div
                  key={run._id}
                  className={`card stat-card ${selectedRun?._id === run._id ? 'selected' : ''}`}
                  onClick={() => handleSelectRun(run)}
                  style={{ cursor: 'pointer', borderLeft: '3px solid var(--clr-primary)' }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{run.train?.trainNumber}</span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{run.train?.trainName}</h4>
                      <span className="text-xs text-muted">📅 {new Date(run.date).toDateString()}</span>
                    </div>
                    <span className={`badge ${run.liveStatus?.status === 'running' ? 'badge-green' : run.liveStatus?.status === 'cancelled' ? 'badge-red' : 'badge-gray'}`}>
                      {run.liveStatus?.status || 'not_started'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Editor Form */}
        {selectedRun ? (
          <div className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--sp-lg)' }}>
              <div>
                <span className="text-xs text-primary font-mono">{selectedRun.train?.trainNumber}</span>
                <h2 className="section-title">{selectedRun.train?.trainName} — Live Status Update</h2>
              </div>
              <button className="modal-close" onClick={() => setSelectedRun(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdate} className="flex flex-col gap-md">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">🚦 Train Status</label>
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} required>
                    <option value="not_started">Not Started</option>
                    <option value="running">Running (On Time)</option>
                    <option value="reached">Reached Destination</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="diverted">Diverted</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">⏰ Delay Offset (minutes)</label>
                  <input className="form-input" type="number" min={0} value={delayMinutes} onChange={(e) => setDelayMinutes(e.target.value)} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">📍 Last Crossed Station Code</label>
                  <input className="form-input" placeholder="e.g. NDLS" value={currentStationCode} onChange={(e) => setCurrentStationCode(e.target.value.toUpperCase())} />
                </div>
                <div className="form-group">
                  <label className="form-label">🚨 Emergency Alerts (comma separated)</label>
                  <input className="form-input" placeholder="e.g. Heavy fog, Signal issues" value={alertsInput} onChange={(e) => setAlertsInput(e.target.value)} />
                </div>
              </div>

              {/* Platform assignment mapping */}
              {selectedRun.train?.route?.stops?.length > 0 && (
                <div style={{ marginTop: 'var(--sp-md)' }}>
                  <h3 className="section-title" style={{ fontSize: '0.9rem', marginBottom: 'var(--sp-sm)' }}>🏛 Platform Numbers at stops</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Stop Order</th>
                          <th>Station Code / Name</th>
                          <th>Platform Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRun.train.route.stops.map((stop) => {
                          const stopStation = stop.station;
                          // If station is populated object or just code
                          const stCode = stopStation.code || stopStation;
                          const stName = stopStation.name || '';
                          return (
                            <tr key={stop._id}>
                              <td>{stop.stopOrder}</td>
                              <td>
                                <strong>{stCode}</strong> {stName && <span className="text-muted text-xs">— {stName}</span>}
                              </td>
                              <td>
                                <input
                                  className="form-input form-input-sm"
                                  style={{ maxWidth: 100, height: 32 }}
                                  placeholder="e.g. 3"
                                  value={platformsInput[stCode] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPlatformsInput((p) => ({ ...p, [stCode]: val }));
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-md" style={{ marginTop: 'var(--sp-lg)' }}>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setSelectedRun(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saving...</> : '📡 Publish Live Update'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">📡</span>
            <h3>Select active run</h3>
            <p>Select one of the runs from the left list to update its live parameters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
