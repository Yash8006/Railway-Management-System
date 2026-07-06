import { useState, useEffect } from 'react';
import { getMyBookings, cancelBooking, getRefundPreview, downloadTicket } from '../api/api';
import { useToast } from '../context/ToastContext';
import './MyBookingsPage.css';

const STATUS_BADGES = {
  confirmed: 'badge-green',
  rac: 'badge-amber',
  waitlisted: 'badge-orange',
  cancelled: 'badge-red',
};

const STATUS_ICONS = {
  confirmed: '✅',
  rac: '⏳',
  waitlisted: '📋',
  cancelled: '❌',
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancelModal, setCancelModal] = useState(null);
  const [refundPreview, setRefundPreview] = useState(null);
  const [loadingRefund, setLoadingRefund] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await getMyBookings();
      setBookings(res.data.data || []);
    } catch {
      addToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = async (booking) => {
    setCancelModal(booking);
    setRefundPreview(null);
    setLoadingRefund(true);
    try {
      const res = await getRefundPreview(booking._id);
      setRefundPreview(res.data.data);
    } catch {
      // refund preview optional
    } finally {
      setLoadingRefund(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      await cancelBooking(cancelModal._id);
      addToast(`Booking cancelled. Refund credited to RMS Wallet!`, 'success');
      setCancelModal(null);
      fetchBookings();
    } catch (err) {
      addToast(err.response?.data?.message || 'Cancellation failed', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownload = async (booking) => {
    try {
      const res = await downloadTicket(booking._id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ticket_PNR_${booking.pnr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('PDF ticket downloaded!', 'success');
    } catch {
      addToast('Failed to download ticket', 'error');
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const counts = {
    all: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    rac: bookings.filter((b) => b.status === 'rac').length,
    waitlisted: bookings.filter((b) => b.status === 'waitlisted').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">🎫 My Bookings</h1>
        <p className="page-subtitle">Your complete booking history — download tickets, cancel & get refunds</p>
      </div>

      {/* Status filter tabs */}
      <div className="tabs" style={{ marginBottom: 'var(--sp-lg)' }}>
        {[
          { key: 'all', label: `All (${counts.all})` },
          { key: 'confirmed', label: `✅ Confirmed (${counts.confirmed})` },
          { key: 'rac', label: `⏳ RAC (${counts.rac})` },
          { key: 'waitlisted', label: `📋 WL (${counts.waitlisted})` },
          { key: 'cancelled', label: `❌ Cancelled (${counts.cancelled})` },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${filter === t.key ? 'active' : ''}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🎫</span>
          <h3>No bookings found</h3>
          <p>{filter === 'all' ? 'You have not made any bookings yet.' : `No ${filter} bookings.`}</p>
          <a href="/" className="btn btn-primary">Search Trains</a>
        </div>
      ) : (
        <div className="bookings-list">
          {filtered.map((b) => (
            <div key={b._id} className={`booking-card ${b.status}`}>
              <div className="booking-card-header">
                <div className="booking-pnr-row">
                  <span className="booking-pnr">PNR: {b.pnr}</span>
                  <span className={`badge ${STATUS_BADGES[b.status]}`}>
                    {STATUS_ICONS[b.status]} {b.status.toUpperCase()}
                  </span>
                </div>
                <div className="booking-train">
                  <span className="train-num-sm">{b.trainNumber}</span>
                  <span className="train-name-sm">{b.trainName}</span>
                </div>
              </div>

              <div className="booking-journey">
                <div className="bj-point">
                  <div className="bj-station">{b.sourceStation}</div>
                  <div className="bj-label">From</div>
                </div>
                <div className="bj-arrow">→</div>
                <div className="bj-point">
                  <div className="bj-station">{b.destinationStation}</div>
                  <div className="bj-label">To</div>
                </div>
                <div className="bj-divider" />
                <div className="bj-info">
                  <div className="bj-label">Date</div>
                  <div className="bj-value">{new Date(b.dateOfJourney).toDateString()}</div>
                </div>
                <div className="bj-info">
                  <div className="bj-label">Class</div>
                  <div className="bj-value">{b.classType}</div>
                </div>
                <div className="bj-info">
                  <div className="bj-label">Quota</div>
                  <div className="bj-value">{b.quota}</div>
                </div>
                <div className="bj-info">
                  <div className="bj-label">Fare</div>
                  <div className="bj-value" style={{ color: 'var(--clr-text)', fontWeight: 700 }}>₹{b.fare}</div>
                </div>
              </div>

              {/* Passengers */}
              <div className="booking-passengers">
                {b.passengers?.map((p, i) => (
                  <div key={i} className="booking-passenger-chip">
                    <span>{p.name}</span>
                    <span className="text-muted">({p.age}, {p.gender})</span>
                    <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{p.seatNumber}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="booking-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(b)}>
                  📄 Download PDF
                </button>
                {b.status !== 'cancelled' && (
                  <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(b)}>
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">❌ Cancel Booking</h2>
              <button className="modal-close" onClick={() => setCancelModal(null)}>✕</button>
            </div>

            <p style={{ marginBottom: 'var(--sp-md)', color: 'var(--clr-text-muted)' }}>
              Are you sure you want to cancel PNR <strong>{cancelModal.pnr}</strong>?
            </p>

            {loadingRefund ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : refundPreview ? (
              <div className="refund-preview">
                <div className="refund-row">
                  <span>Original Fare</span>
                  <span>₹{cancelModal.fare}</span>
                </div>
                <div className="refund-row">
                  <span>Cancellation Charge ({100 - refundPreview.percent}%)</span>
                  <span className="text-red">-₹{Math.round(refundPreview.charge)}</span>
                </div>
                <div className="divider" style={{ margin: '8px 0' }} />
                <div className="refund-row refund-total">
                  <span>Refund to RMS Wallet</span>
                  <strong className="text-green">₹{Math.round(refundPreview.refundAmount)}</strong>
                </div>
                {refundPreview.percent === 0 && (
                  <div className="error-box" style={{ marginTop: 'var(--sp-sm)' }}>
                    ⚠️ Journey departure is less than 4 hours away. No refund will be issued.
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex gap-md" style={{ marginTop: 'var(--sp-lg)' }}>
              <button className="btn btn-ghost flex-1" onClick={() => setCancelModal(null)}>Keep Booking</button>
              <button className="btn btn-danger flex-1" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? <><span className="spinner" /> Cancelling...</> : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
