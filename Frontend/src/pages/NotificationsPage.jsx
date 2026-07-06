import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead } from '../api/api';
import { useToast } from '../context/ToastContext';

const CATEGORY_ICONS = {
  booking: '🎫',
  waitlist_upgrade: '📈',
  delay: '⏰',
  cancellation: '❌',
  upcoming_journey: '🚂',
};

const TYPE_COLORS = {
  sms: 'badge-purple',
  email: 'badge-blue',
  in_app: 'badge-green',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try { const r = await getNotifications(); setNotifications(r.data.data || []); }
    catch { addToast('Failed to load notifications', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((p) => p.map((n) => n._id === id ? { ...n, read: true } : n));
    } catch { /* silent */ }
  };

  const filtered = filter === 'all' ? notifications : filter === 'unread' ? notifications.filter((n) => !n.read) : notifications.filter((n) => n.category === filter);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="flex items-center gap-md">
          <h1 className="page-title">🔔 Notifications</h1>
          {unreadCount > 0 && <span className="badge badge-orange">{unreadCount} new</span>}
        </div>
        <p className="page-subtitle">Booking alerts, delay updates, and waitlist promotions</p>
      </div>

      <div className="tabs">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'booking', label: '🎫 Booking' },
          { key: 'delay', label: '⏰ Delay' },
          { key: 'waitlist_upgrade', label: '📈 WL Upgrade' },
          { key: 'cancellation', label: '❌ Cancellation' },
        ].map((t) => (
          <button key={t.key} className={`tab-btn ${filter === t.key ? 'active' : ''}`} onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🔔</span>
          <h3>No notifications</h3>
          <p>You're all caught up! Booking alerts will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {filtered.map((n) => (
            <div
              key={n._id}
              className={`card notification-card ${!n.read ? 'unread' : ''}`}
              onClick={() => !n.read && handleRead(n._id)}
              style={{ cursor: !n.read ? 'pointer' : 'default' }}
            >
              <div className="flex items-center gap-md">
                <div className="notif-icon">{CATEGORY_ICONS[n.category] || '📩'}</div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-sm" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.9375rem' }}>{n.title}</strong>
                    <span className={`badge ${TYPE_COLORS[n.type] || 'badge-gray'}`}>{n.type}</span>
                    {!n.read && <span className="notification-dot" />}
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{n.message}</p>
                  <div className="text-xs text-faint" style={{ marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleString('en-IN')}
                  </div>
                </div>
                {!n.read && (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRead(n._id)}>Mark read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
