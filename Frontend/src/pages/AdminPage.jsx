import { useState, useEffect } from 'react';
import {
  getStations, createStation, deleteStation,
  getTrains, createTrain, deleteTrain,
  getRoutes, createRoute, deleteRoute,
  getSchedules, createSchedule, instantiateSchedule, deleteSchedule,
  getSalesAnalytics, getOccupancyAnalytics, getDemographicsAnalytics,
} from '../api/api';
import { useToast } from '../context/ToastContext';
import './AdminPage.css';

const TABS = [
  { key: 'analytics', label: '📊 Analytics' },
  { key: 'stations', label: '🏛 Stations' },
  { key: 'routes', label: '🗺 Routes' },
  { key: 'trains', label: '🚂 Trains' },
  { key: 'schedules', label: '📅 Schedules' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('analytics');

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">⚙️ Admin Console</h1>
        <p className="page-subtitle">Manage stations, routes, trains, schedules, and view analytics</p>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'stations' && <StationsTab />}
      {tab === 'routes' && <RoutesTab />}
      {tab === 'trains' && <TrainsTab />}
      {tab === 'schedules' && <SchedulesTab />}
    </div>
  );
}

/* ==================== ANALYTICS TAB ==================== */
function AnalyticsTab() {
  const { addToast } = useToast();
  const [sales, setSales] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSalesAnalytics(), getOccupancyAnalytics(), getDemographicsAnalytics()])
      .then(([s, o, d]) => { setSales(s.data.data); setOccupancy(o.data.data); setDemographics(d.data.data); })
      .catch(() => addToast('Failed to load analytics', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-center"><div className="spinner spinner-lg" /></div>;

  const totalRevenue = sales?.dailySales?.reduce((s, d) => s + d.revenue, 0) || 0;
  const totalBookings = sales?.dailySales?.reduce((s, d) => s + d.bookingsCount, 0) || 0;
  const lowOccupancyCount = occupancy?.lowOccupancyAlerts?.length || 0;

  return (
    <div>
      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 'var(--sp-xl)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>💰</div>
          <div className="stat-value gradient-text">₹{totalRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>🎫</div>
          <div className="stat-value" style={{ color: 'var(--clr-green)' }}>{totalBookings}</div>
          <div className="stat-label">Total Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(249,115,22,0.15)' }}>📈</div>
          <div className="stat-value" style={{ color: 'var(--clr-orange)' }}>{sales?.classBreakdown?.length || 0}</div>
          <div className="stat-label">Active Classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>⚠️</div>
          <div className="stat-value" style={{ color: lowOccupancyCount > 0 ? 'var(--clr-red)' : 'var(--clr-green)' }}>{lowOccupancyCount}</div>
          <div className="stat-label">Low Occupancy Alerts</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-lg)', marginBottom: 'var(--sp-lg)' }}>
        {/* Class Breakdown */}
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>Revenue by Class</h3>
          {sales?.classBreakdown?.map((c, i) => {
            const maxRev = Math.max(...sales.classBreakdown.map((x) => x.revenue));
            return (
              <div key={i} style={{ marginBottom: 'var(--sp-sm)' }}>
                <div className="flex justify-between text-sm" style={{ marginBottom: 4 }}>
                  <span>{c._id}</span>
                  <span style={{ fontWeight: 600 }}>₹{c.revenue.toLocaleString()} ({c.bookingsCount} bookings)</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {!sales?.classBreakdown?.length && <div className="text-muted text-sm">No data yet</div>}
        </div>

        {/* Quota Breakdown */}
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>Revenue by Quota</h3>
          {sales?.quotaBreakdown?.map((q, i) => {
            const maxRev = Math.max(...sales.quotaBreakdown.map((x) => x.revenue));
            const qNames = { GN: 'General', TQ: 'Tatkal ⚡', LD: 'Ladies', SR: 'Senior' };
            return (
              <div key={i} style={{ marginBottom: 'var(--sp-sm)' }}>
                <div className="flex justify-between text-sm" style={{ marginBottom: 4 }}>
                  <span>{qNames[q._id] || q._id}</span>
                  <span style={{ fontWeight: 600 }}>₹{q.revenue.toLocaleString()} ({q.bookingsCount})</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(q.revenue / maxRev) * 100}%`, background: 'linear-gradient(90deg, var(--clr-orange), var(--clr-amber))' }} />
                </div>
              </div>
            );
          })}
          {!sales?.quotaBreakdown?.length && <div className="text-muted text-sm">No data yet</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-lg)' }}>
        {/* Demographics */}
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>Passenger Age Groups</h3>
          {demographics?.ageGroups?.map((g, i) => (
            <div key={i} className="flex justify-between text-sm" style={{ padding: '6px 0', borderBottom: '1px solid var(--clr-border)' }}>
              <span>{g.group}</span>
              <strong>{g.count} passengers</strong>
            </div>
          ))}
          {!demographics?.ageGroups?.length && <div className="text-muted text-sm">No data yet</div>}
        </div>

        {/* Low Occupancy Alerts */}
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>⚠️ Low Occupancy Runs</h3>
          {occupancy?.lowOccupancyAlerts?.length === 0 && <div className="badge badge-green">✓ All runs have good occupancy</div>}
          {occupancy?.lowOccupancyAlerts?.map((a, i) => (
            <div key={i} className="flex justify-between items-center text-sm" style={{ padding: '6px 0', borderBottom: '1px solid var(--clr-border)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{a.trainNumber} — {a.trainName}</div>
                <div className="text-muted">{new Date(a.date).toDateString()}</div>
              </div>
              <span className="badge badge-red">{a.occupancyPercent}% full</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== STATIONS TAB ==================== */
function StationsTab() {
  const { addToast } = useToast();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', city: '', zone: '', coordinates: { latitude: '', longitude: '' } });

  const load = async () => { setLoading(true); try { const r = await getStations(); setStations(r.data.data || []); } catch { addToast('Failed to load stations', 'error'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createStation({ ...form, coordinates: { latitude: Number(form.coordinates.latitude), longitude: Number(form.coordinates.longitude) } });
      addToast('Station created!', 'success'); setShowForm(false); load();
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this station?')) return;
    try { await deleteStation(id); addToast('Station deleted', 'success'); load(); } catch { addToast('Failed to delete', 'error'); }
  };

  const ZONES = ['Northern', 'Southern', 'Eastern', 'Western', 'Central', 'South Central', 'North Eastern', 'East Central'];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Station Registry ({stations.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((p) => !p)}>
          {showForm ? '✕ Cancel' : '+ Add Station'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--sp-lg)', borderColor: 'rgba(59,130,246,0.3)' }}>
          <form onSubmit={handleCreate} className="flex flex-col gap-md">
            <div className="form-row">
              <div className="form-group"><label className="form-label">Station Code *</label><input className="form-input" placeholder="NDLS" required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
              <div className="form-group"><label className="form-label">Station Name *</label><input className="form-input" placeholder="New Delhi" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">City *</label><input className="form-input" placeholder="Delhi" required value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Zone *</label><select className="form-select" required value={form.zone} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}><option value="">Select Zone</option>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Latitude *</label><input className="form-input" type="number" step="any" placeholder="28.6139" required value={form.coordinates.latitude} onChange={(e) => setForm((p) => ({ ...p, coordinates: { ...p.coordinates, latitude: e.target.value } }))} /></div>
              <div className="form-group"><label className="form-label">Longitude *</label><input className="form-input" type="number" step="any" placeholder="77.2090" required value={form.coordinates.longitude} onChange={(e) => setForm((p) => ({ ...p, coordinates: { ...p.coordinates, longitude: e.target.value } }))} /></div>
            </div>
            <button type="submit" className="btn btn-primary">🏛 Create Station</button>
          </form>
        </div>
      )}

      {loading ? <div className="spinner-center"><div className="spinner" /></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>City</th><th>Zone</th><th>Coordinates</th><th>Actions</th></tr></thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s._id}>
                  <td><span className="badge badge-blue">{s.code}</span></td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="text-muted">{s.city}</td>
                  <td className="text-muted">{s.zone}</td>
                  <td className="text-xs text-faint" style={{ fontFamily: 'var(--font-mono)' }}>{s.coordinates?.latitude?.toFixed(4)}, {s.coordinates?.longitude?.toFixed(4)}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(s._id)}>🗑 Delete</button></td>
                </tr>
              ))}
              {stations.length === 0 && <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 'var(--sp-xl)' }}>No stations yet. Add your first station.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== ROUTES TAB ==================== */
function RoutesTab() {
  const { addToast } = useToast();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); try { const r = await getRoutes(); setRoutes(r.data.data || []); } catch { addToast('Failed', 'error'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this route?')) return;
    try { await deleteRoute(id); addToast('Route deleted', 'success'); load(); } catch { addToast('Failed to delete', 'error'); }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Routes ({routes.length})</h2>
        <div className="info-box" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>ℹ️ Route creation requires station ObjectIds — use API or extend form.</div>
      </div>

      {loading ? <div className="spinner-center"><div className="spinner" /></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Route Name</th><th>Stops</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td><span className="badge badge-blue">{r.stops?.length} stops</span></td>
                  <td className="text-muted">{new Date(r.createdAt).toDateString()}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(r._id)}>🗑 Delete</button></td>
                </tr>
              ))}
              {routes.length === 0 && <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 'var(--sp-xl)' }}>No routes configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== TRAINS TAB ==================== */
function TrainsTab() {
  const { addToast } = useToast();
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); try { const r = await getTrains(); setTrains(r.data.data || []); } catch { addToast('Failed', 'error'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this train?')) return;
    try { await deleteTrain(id); addToast('Train deleted', 'success'); load(); } catch { addToast('Failed to delete', 'error'); }
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Trains ({trains.length})</h2>
        <div className="info-box" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>ℹ️ Train creation requires route ObjectId. Use API or Postman for complex configurations.</div>
      </div>

      {loading ? <div className="spinner-center"><div className="spinner" /></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Number</th><th>Name</th><th>Type</th><th>Coaches</th><th>Actions</th></tr></thead>
            <tbody>
              {trains.map((t) => (
                <tr key={t._id}>
                  <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--clr-primary)', fontWeight: 600 }}>{t.trainNumber}</span></td>
                  <td style={{ fontWeight: 600 }}>{t.trainName}</td>
                  <td>
                    <span className={`badge ${t.trainType === 'Superfast' ? 'badge-orange' : t.trainType === 'Express' ? 'badge-blue' : 'badge-gray'}`}>{t.trainType}</span>
                  </td>
                  <td>{t.coaches?.length || 0} coaches</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(t._id)}>🗑 Delete</button></td>
                </tr>
              ))}
              {trains.length === 0 && <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 'var(--sp-xl)' }}>No trains configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== SCHEDULES TAB ==================== */
function SchedulesTab() {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instantiating, setInstantiating] = useState(null);

  const load = async () => { setLoading(true); try { const r = await getSchedules(); setSchedules(r.data.data || []); } catch { addToast('Failed', 'error'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleInstantiate = async (id) => {
    setInstantiating(id);
    try {
      const r = await instantiateSchedule(id);
      addToast(`Instantiated ${r.data.data?.created || 0} scheduled runs!`, 'success');
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setInstantiating(null); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete schedule?')) return;
    try { await deleteSchedule(id); addToast('Schedule deleted', 'success'); load(); } catch { addToast('Failed', 'error'); }
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Train Schedules ({schedules.length})</h2>
      </div>
      <div className="info-box" style={{ marginBottom: 'var(--sp-md)' }}>
        ℹ️ Schedules define when a train runs. After creating a schedule, click <strong>Instantiate Runs</strong> to materialize daily seat inventories for bookings.
      </div>

      {loading ? <div className="spinner-center"><div className="spinner" /></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Train</th><th>Frequency</th><th>Running Days</th><th>Period</th><th>Actions</th></tr></thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 600 }}>{s.train?.trainName || s.train}</td>
                  <td><span className="badge badge-purple">{s.frequency}</span></td>
                  <td>
                    {s.frequency === 'Weekly' && s.runningDays?.map((d) => <span key={d} className="badge badge-blue" style={{ marginRight: 4 }}>{DAYS[d]}</span>)}
                    {s.frequency === 'Daily' && <span className="text-muted text-sm">Everyday</span>}
                    {s.frequency === 'Custom' && <span className="text-muted text-sm">{s.customDates?.length} dates</span>}
                  </td>
                  <td className="text-sm text-muted">{new Date(s.startDate).toDateString()} → {new Date(s.endDate).toDateString()}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleInstantiate(s._id)}
                        disabled={instantiating === s._id}
                      >
                        {instantiating === s._id ? <><span className="spinner" /> Running...</> : '⚡ Instantiate Runs'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s._id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 'var(--sp-xl)' }}>No schedules configured. Create a schedule via the API first.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
