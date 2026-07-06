import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createBooking, getFareEstimate, getCoPassengers } from '../api/api.js';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './BookingPage.css';

const BERTH_TYPES = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];
const ID_PROOFS = ['Aadhaar', 'Passport', 'PAN', 'Voter ID', 'Driving License'];

const blankPassenger = () => ({ name: '', age: '', gender: 'male', isDisabled: false });

export default function BookingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const { train = {}, searchParams = {}, quota = 'GN' } = location.state || {};
  const [passengers, setPassengers] = useState([blankPassenger()]);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [loading, setLoading] = useState(false);
  const [fareInfo, setFareInfo] = useState(null);
  const [loadingFare, setLoadingFare] = useState(false);
  const [savedCoPassengers, setSavedCoPassengers] = useState([]);
  const [selectedQuota] = useState(quota);

  useEffect(() => {
    if (!location.state) navigate('/');
    getCoPassengers().then((r) => setSavedCoPassengers(r.data.data || [])).catch(() => {});
    loadFare();
  }, [passengers.length]);

  const loadFare = async () => {
    if (!train.trainNumber || !searchParams.from || !searchParams.to || !searchParams.date) return;
    setLoadingFare(true);
    try {
      const res = await getFareEstimate({
        trainNumber: train.trainNumber,
        date: searchParams.date,
        from: searchParams.from,
        to: searchParams.to,
        classType: train.classType || searchParams.classType || 'Sleeper',
        quota: selectedQuota,
      });
      setFareInfo(res.data.data);
    } catch {
      // fare info optional
    } finally {
      setLoadingFare(false);
    }
  };

  const updatePassenger = (idx, field, val) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const addPassenger = () => {
    if (passengers.length >= 6) { addToast('Maximum 6 passengers per booking', 'warning'); return; }
    setPassengers((p) => [...p, blankPassenger()]);
  };

  const removePassenger = (idx) => {
    if (passengers.length <= 1) return;
    setPassengers((p) => p.filter((_, i) => i !== idx));
  };

  const importCoPassenger = (cp, idx) => {
    updatePassenger(idx, 'name', cp.name);
    updatePassenger(idx, 'age', cp.age);
    updatePassenger(idx, 'gender', cp.gender);
  };

  const totalFare = fareInfo ? fareInfo.totalFare * passengers.length : null;

  const handleBook = async () => {
    for (const p of passengers) {
      if (!p.name || !p.age || !p.gender) {
        addToast('Please fill all passenger details', 'warning');
        return;
      }
      if (Number(p.age) < 0 || Number(p.age) > 120) {
        addToast('Please enter a valid age', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await createBooking({
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        sourceStation: searchParams.from,
        destinationStation: searchParams.to,
        classType: train.classType || searchParams.classType || 'Sleeper',
        fare: totalFare || 500,
        passengers: passengers.map((p) => ({
          name: p.name,
          age: Number(p.age),
          gender: p.gender,
          isDisabled: p.isDisabled || false,
        })),
        dateOfJourney: searchParams.date,
        paymentMethod,
        quota: selectedQuota,
      });

      addToast(`🎉 Booking confirmed! PNR: ${res.data.data.pnr}`, 'success');
      navigate('/bookings');
    } catch (err) {
      addToast(err.response?.data?.message || 'Booking failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">🎫 Book Ticket</h1>
        <p className="page-subtitle">
          {train.trainNumber} — {train.trainName} &nbsp;·&nbsp;
          {searchParams.from} → {searchParams.to} &nbsp;·&nbsp;
          {new Date(searchParams.date).toDateString()}
        </p>
      </div>

      <div className="booking-layout">
        {/* Left — Passenger Form */}
        <div className="booking-main">
          {/* Passenger Cards */}
          <div className="card" style={{ marginBottom: 'var(--sp-lg)' }}>
            <div className="section-header">
              <h2 className="section-title">👥 Passenger Details</h2>
              <button className="btn btn-ghost btn-sm" onClick={addPassenger}>+ Add Passenger</button>
            </div>

            <div className="passengers-list">
              {passengers.map((p, idx) => (
                <div key={idx} className="passenger-card">
                  <div className="passenger-card-header">
                    <span className="passenger-num">Passenger {idx + 1}</span>
                    {savedCoPassengers.length > 0 && (
                      <div className="import-select-wrap">
                        <select
                          className="form-select"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                          defaultValue=""
                          onChange={(e) => {
                            const cp = savedCoPassengers.find((c) => c._id === e.target.value);
                            if (cp) importCoPassenger(cp, idx);
                          }}
                        >
                          <option value="" disabled>📋 Import saved</option>
                          {savedCoPassengers.map((cp) => (
                            <option key={cp._id} value={cp._id}>{cp.name} ({cp.age})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {passengers.length > 1 && (
                      <button className="btn btn-danger btn-sm" onClick={() => removePassenger(idx)}>✕ Remove</button>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input className="form-input" placeholder="Name as on ID" value={p.name} onChange={(e) => updatePassenger(idx, 'name', e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Age *</label>
                      <input className="form-input" type="number" placeholder="Age" min={0} max={120} value={p.age} onChange={(e) => updatePassenger(idx, 'age', e.target.value)} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Gender *</label>
                      <select className="form-select" value={p.gender} onChange={(e) => updatePassenger(idx, 'gender', e.target.value)}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                      <label className="form-label" style={{ marginBottom: 8 }}>Special Assistance</label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={p.isDisabled}
                          onChange={(e) => updatePassenger(idx, 'isDisabled', e.target.checked)}
                        />
                        <span>Disabled / Senior priority (Lower berth auto-assigned)</span>
                      </label>
                    </div>
                  </div>

                  {Number(p.age) >= 60 && (
                    <div className="info-box" style={{ marginTop: 'var(--sp-sm)' }}>
                      👴 Senior citizen detected. Lower berth will be auto-prioritized during seat allocation.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quota Info */}
          <div className="card" style={{ marginBottom: 'var(--sp-lg)' }}>
            <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>📋 Booking Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quota Selected</label>
                <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                  {selectedQuota === 'TQ' && <span>⚡</span>}
                  <strong>{selectedQuota}</strong>
                  <span className="text-muted">
                    {selectedQuota === 'GN' ? '— General' : selectedQuota === 'TQ' ? '— Tatkal (+30%)' : selectedQuota === 'LD' ? '— Ladies' : '— Senior Citizen'}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Class</label>
                <div className="form-input">
                  <strong>{train.classType || searchParams.classType || 'Sleeper'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="card">
            <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>💳 Payment Method</h3>
            <div className="payment-options">
              {[
                { value: 'wallet', icon: '💰', label: 'RMS Wallet', desc: 'Instant deduction from your balance' },
                { value: 'card', icon: '💳', label: 'Credit/Debit Card', desc: 'Simulated via Stripe gateway' },
                { value: 'upi', icon: '📱', label: 'UPI', desc: 'Simulated via Razorpay gateway' },
              ].map((opt) => (
                <label key={opt.value} className={`payment-option ${paymentMethod === opt.value ? 'selected' : ''}`}>
                  <input type="radio" name="payment" value={opt.value} checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)} />
                  <span className="payment-icon">{opt.icon}</span>
                  <div>
                    <div className="payment-label">{opt.label}</div>
                    <div className="payment-desc">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Fare Summary */}
        <aside className="booking-sidebar">
          <div className="card fare-summary">
            <h3 className="section-title" style={{ marginBottom: 'var(--sp-md)' }}>💰 Fare Summary</h3>

            {loadingFare ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : fareInfo ? (
              <div className="fare-breakdown">
                <div className="fare-row">
                  <span>Base Fare</span>
                  <span>₹{fareInfo.baseFare}</span>
                </div>
                <div className="fare-row">
                  <span>Distance ({fareInfo.distanceKm} km)</span>
                  <span>₹{fareInfo.distanceCharge}</span>
                </div>
                <div className="fare-row">
                  <span>Class Surcharge ({fareInfo.classMultiplier}×)</span>
                  <span>×{fareInfo.classMultiplier}</span>
                </div>
                {fareInfo.quotaMultiplier > 1 && (
                  <div className="fare-row text-orange">
                    <span>⚡ Tatkal Premium</span>
                    <span>×{fareInfo.quotaMultiplier}</span>
                  </div>
                )}
                {fareInfo.dynamicPricingMultiplier > 1 && (
                  <div className="fare-row text-amber">
                    <span>🔥 Dynamic Pricing</span>
                    <span>×{fareInfo.dynamicPricingMultiplier}</span>
                  </div>
                )}
                <div className="divider" />
                <div className="fare-row">
                  <span>Per Passenger</span>
                  <strong>₹{fareInfo.totalFare}</strong>
                </div>
                <div className="fare-row">
                  <span>Passengers</span>
                  <span>× {passengers.length}</span>
                </div>
                <div className="divider" />
                <div className="fare-total">
                  <span>Total Amount</span>
                  <strong className="gradient-text">₹{fareInfo.totalFare * passengers.length}</strong>
                </div>

                {fareInfo.occupancyRate > 0 && (
                  <div className="occupancy-bar">
                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                      <span className="text-xs text-muted">Occupancy</span>
                      <span className="text-xs text-muted">{Math.round(fareInfo.occupancyRate * 100)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${fareInfo.occupancyRate * 100}%`,
                          background: fareInfo.occupancyRate > 0.8 ? 'var(--clr-red)' : fareInfo.occupancyRate > 0.5 ? 'var(--clr-amber)' : 'var(--clr-green)'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted text-sm">Fare details unavailable. Server will compute final amount.</div>
            )}

            <button
              className="btn btn-orange btn-lg w-full"
              style={{ marginTop: 'var(--sp-lg)' }}
              onClick={handleBook}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Confirming...</> : `🎫 Confirm Booking${totalFare ? ` · ₹${totalFare}` : ''}`}
            </button>

            <div className="warning-box" style={{ marginTop: 'var(--sp-md)' }}>
              ⚠️ Seats are reserved atomically. Your seat will be confirmed or placed in RAC/WL.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
