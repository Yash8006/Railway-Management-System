import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { searchConnected, searchTrains } from '../api/api';
import { useToast } from '../context/ToastContext';
import './SearchResultsPage.css';

const CLASS_LABELS = {
  Sleeper: 'SL',
  'AC 3 Tier': '3A',
  'AC 2 Tier': '2A',
  'First Class': '1A',
};

const QUOTA_LABELS = { GN: 'General', TQ: 'Tatkal', LD: 'Ladies', SR: 'Senior Citizen' };

// What: Dynamic client-side fare estimator.
// Why: Estimates fares dynamically on the search results screen before booking, aligning with the backend pricing logic.
// Alternatives: Fetching pricing estimations via bulk network API queries for all trains at once.
// Why not alternatives: Bulk network queries degrade server latency and increase traffic. Computing estimate locally has zero lag.
function estimateFare(distanceKm, classType, quota) {
  const baseFare = 150;
  const distanceCharge = distanceKm * 1.25;
  let classMultiplier = 1.0;
  if (classType === 'AC 3 Tier') classMultiplier = 2.2;
  else if (classType === 'AC 2 Tier') classMultiplier = 3.2;
  else if (classType === 'First Class') classMultiplier = 4.5;
  
  let quotaMultiplier = 1.0;
  if (quota === 'TQ') quotaMultiplier = 1.30;
  
  return Math.round((baseFare + distanceCharge) * classMultiplier * quotaMultiplier);
}

function statusBadge(avail) {
  if (avail === 0) return <span className="badge badge-red">FULL</span>;
  if (avail <= 5) return <span className="badge badge-amber">⚠ {avail} left</span>;
  return <span className="badge badge-green">✓ {avail} avail</span>;
}

export default function SearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const { results: initialDirectResults = [], searchParams = {} } = location.state || {};
  
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' or 'connected'
  const [directResults, setDirectResults] = useState(initialDirectResults);
  const [connectedResults, setConnectedResults] = useState([]);
  
  const [filterClass, setFilterClass] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedQuota, setSelectedQuota] = useState('GN');
  const [sortBy, setSortBy] = useState('departure');
  
  const [loadingConnected, setLoadingConnected] = useState(false);

  useEffect(() => {
    if (!location.state) return;
    if (activeTab === 'connected' && connectedResults.length === 0) {
      loadConnectedJourneys();
    }
  }, [activeTab]);

  const loadConnectedJourneys = async () => {
    setLoadingConnected(true);
    try {
      const params = {
        from: searchParams.from,
        to: searchParams.to,
        date: searchParams.date,
      };
      if (searchParams.trainType) params.trainType = searchParams.trainType;
      
      const res = await searchConnected(params);
      setConnectedResults(res.data.data || res.data || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load connecting journeys', 'error');
    } finally {
      setLoadingConnected(false);
    }
  };

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

  // Filter & Sort Direct Results
  const filteredDirect = directResults
    .filter((train) => {
      // If class is filtered, check if train offers availability in that class
      if (filterClass && !train.classes[filterClass]) return false;
      if (filterType && train.trainType !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      const aDep = a.source?.departureTime || '';
      const bDep = b.source?.departureTime || '';
      if (sortBy === 'departure') return aDep.localeCompare(bDep);
      
      const aDur = parseFloat(a.duration) || 0;
      const bDur = parseFloat(b.duration) || 0;
      if (sortBy === 'duration') return aDur - bDur;
      
      if (sortBy === 'fare') {
        const aMinFare = Math.min(...Object.keys(a.classes).map(c => estimateFare(a.distanceKm, c, selectedQuota)));
        const bMinFare = Math.min(...Object.keys(b.classes).map(c => estimateFare(b.distanceKm, c, selectedQuota)));
        return aMinFare - bMinFare;
      }
      return 0;
    });

  const handleBookDirect = (train, classType) => {
    if (!user) {
      navigate('/login');
      return;
    }
    const bookingTrain = {
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      classType,
    };
    navigate('/booking', { state: { train: bookingTrain, searchParams, quota: selectedQuota } });
  };

  const handleBookLeg = (leg, classType) => {
    if (!user) {
      navigate('/login');
      return;
    }
    const bookingTrain = {
      trainNumber: leg.trainNumber,
      trainName: leg.trainName,
      classType,
    };
    // Modify searchParams date and station to match the leg
    const legSearchParams = {
      ...searchParams,
      from: leg.source.code,
      to: leg.destination.code,
      date: new Date(leg.source.departureDateTime).toISOString().split('T')[0]
    };
    navigate('/booking', { state: { train: bookingTrain, searchParams: legSearchParams, quota: selectedQuota } });
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
            📅 {new Date(searchParams.date).toDateString()}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          ← Modify Search
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'direct' ? 'active' : ''}`} onClick={() => setActiveTab('direct')}>
          🚂 Direct Trains ({filteredDirect.length})
        </button>
        <button className={`tab-btn ${activeTab === 'connected' ? 'active' : ''}`} onClick={() => setActiveTab('connected')}>
          🗺️ Connecting Routes ({connectedResults.length})
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

            {activeTab === 'direct' && (
              <>
                <div className="form-group" style={{ marginBottom: 'var(--sp-md)' }}>
                  <label className="form-label">Preferred Class</label>
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
              </>
            )}
          </div>
        </aside>

        {/* Results List */}
        <div className="results-list">
          {activeTab === 'direct' ? (
            filteredDirect.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🚂</span>
                <h3>No direct trains found</h3>
                <p>Try switching to the <strong>Connecting Routes</strong> tab or changing filter selections.</p>
              </div>
            ) : (
              filteredDirect.map((train, idx) => (
                <div key={idx} className="train-card">
                  <div className="train-card-main">
                    {/* Train Info */}
                    <div className="train-info">
                      <div className="train-number">{train.trainNumber}</div>
                      <div className="train-name">{train.trainName}</div>
                      <span className="badge badge-gray">{train.trainType}</span>
                      <div className="text-xs text-muted mt-sm">📍 {train.distanceKm} km</div>
                    </div>

                    {/* Timeline */}
                    <div className="train-journey">
                      <div className="journey-point">
                        <div className="journey-time">{train.source?.departureTime}</div>
                        <div className="journey-station">{train.source?.code}</div>
                        <div className="text-xs text-muted">{train.source?.name}</div>
                      </div>
                      <div className="journey-line">
                        <div className="journey-duration">{train.duration}</div>
                        <div className="journey-track">
                          <div className="track-line" />
                          <span className="track-train">🚂</span>
                        </div>
                      </div>
                      <div className="journey-point">
                        <div className="journey-time">{train.destination?.arrivalTime}</div>
                        <div className="journey-station">{train.destination?.code}</div>
                        <div className="text-xs text-muted">{train.destination?.name}</div>
                      </div>
                    </div>

                    {/* Class List & Booking */}
                    <div className="classes-grid">
                      {Object.entries(train.classes).map(([className, info]) => {
                        const fare = estimateFare(train.distanceKm, className, selectedQuota);
                        const isClassSelected = !filterClass || filterClass === className;
                        if (!isClassSelected) return null;
                        
                        return (
                          <div key={className} className="class-booking-row">
                            <div className="class-info-wrap">
                              <span className="badge badge-blue">{CLASS_LABELS[className] || className}</span>
                              <strong className="class-fare">₹{fare}</strong>
                            </div>
                            <div className="class-avail-status">
                              {statusBadge(info.available)}
                            </div>
                            <button 
                              className="btn btn-orange btn-sm" 
                              onClick={() => handleBookDirect(train, className)}
                              disabled={info.available === 0}
                            >
                              Book
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            /* Connected Journeys Tab */
            loadingConnected ? (
              <div className="spinner-center"><div className="spinner spinner-lg" /></div>
            ) : connectedResults.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🗺️</span>
                <h3>No connecting journeys found</h3>
                <p>Try searching for different stations or other dates.</p>
              </div>
            ) : (
              connectedResults.map((conn, idx) => (
                <div key={idx} className="train-card connected-journey-card" style={{ borderColor: 'rgba(99, 143, 255, 0.25)' }}>
                  {/* Summary Bar */}
                  <div className="connected-journey-header">
                    <span className="badge badge-purple">🔄 1-Transfer Connection</span>
                    <span>📍 Total: <strong>{conn.totalDistanceKm} km</strong></span>
                    <span>⏰ Duration: <strong>{conn.totalDuration}</strong></span>
                    <span>💤 Layover: <strong className="text-orange">{conn.layoverTime}</strong> at {conn.transferStation?.name} ({conn.transferStation?.code})</span>
                  </div>

                  {/* Leg 1 */}
                  <div className="leg-container">
                    <div className="leg-label">Leg 1: {conn.firstLeg?.trainNumber} - {conn.firstLeg?.trainName}</div>
                    <div className="train-card-main">
                      <div className="train-journey flex-1">
                        <div className="journey-point">
                          <div className="journey-time">{conn.firstLeg?.source?.departureTime}</div>
                          <div className="journey-station">{conn.firstLeg?.source?.code}</div>
                        </div>
                        <div className="journey-line">
                          <div className="journey-duration">{conn.firstLeg?.duration}</div>
                          <div className="journey-track"><div className="track-line" /></div>
                        </div>
                        <div className="journey-point">
                          <div className="journey-time">{conn.firstLeg?.destination?.arrivalTime}</div>
                          <div className="journey-station">{conn.firstLeg?.destination?.code}</div>
                        </div>
                      </div>

                      <div className="leg-booking-wrap">
                        {Object.entries(conn.firstLeg?.availableSeats || {}).map(([cls, count]) => (
                          <div key={cls} className="leg-class-row">
                            <span className="badge badge-gray">{CLASS_LABELS[cls] || cls}</span>
                            {statusBadge(count)}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleBookLeg(conn.firstLeg, cls)}>Book Leg 1</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Leg 2 */}
                  <div className="leg-container border-top">
                    <div className="leg-label">Leg 2: {conn.secondLeg?.trainNumber} - {conn.secondLeg?.trainName}</div>
                    <div className="train-card-main">
                      <div className="train-journey flex-1">
                        <div className="journey-point">
                          <div className="journey-time">{conn.secondLeg?.source?.departureTime}</div>
                          <div className="journey-station">{conn.secondLeg?.source?.code}</div>
                        </div>
                        <div className="journey-line">
                          <div className="journey-duration">{conn.secondLeg?.duration}</div>
                          <div className="journey-track"><div className="track-line" /></div>
                        </div>
                        <div className="journey-point">
                          <div className="journey-time">{conn.secondLeg?.destination?.arrivalTime}</div>
                          <div className="journey-station">{conn.secondLeg?.destination?.code}</div>
                        </div>
                      </div>

                      <div className="leg-booking-wrap">
                        {Object.entries(conn.secondLeg?.availableSeats || {}).map(([cls, count]) => (
                          <div key={cls} className="leg-class-row">
                            <span className="badge badge-gray">{CLASS_LABELS[cls] || cls}</span>
                            {statusBadge(count)}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleBookLeg(conn.secondLeg, cls)}>Book Leg 2</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
