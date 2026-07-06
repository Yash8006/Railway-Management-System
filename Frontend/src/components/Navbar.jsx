import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: '🔍 Search Trains' },
    { to: '/tracking', label: '📡 Live Tracking' },
  ];

  const authLinks = user ? [
    { to: '/bookings', label: '🎫 My Bookings' },
    { to: '/notifications', label: '🔔 Alerts' },
    ...(user.role === 'admin' ? [{ to: '/admin', label: '⚙️ Admin' }] : []),
  ] : [];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🚂</span>
          <div>
            <span className="brand-name">RMS</span>
            <span className="brand-tagline">Railway System</span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="navbar-links hide-mobile">
          {[...navLinks, ...authLinks].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${isActive(link.to) ? 'nav-link-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="navbar-right">
          {user ? (
            <div className="user-menu">
              <button
                className="user-avatar-btn"
                onClick={() => setDropdownOpen((p) => !p)}
              >
                <div className="user-avatar">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="user-info hide-mobile">
                  <span className="user-name">{user.name}</span>
                  <span className={`user-role role-${user.role}`}>{user.role}</span>
                </div>
                <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown">
                  <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    👤 Profile
                  </Link>
                  <Link to="/wallet" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    💰 Wallet
                  </Link>
                  <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    👥 Co-Passengers
                  </Link>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-orange btn-sm">Register</Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {[...navLinks, ...authLinks].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`mobile-nav-link ${isActive(link.to) ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {!user && (
            <>
              <Link to="/login" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                🔑 Login
              </Link>
              <Link to="/register" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                📝 Register
              </Link>
            </>
          )}
          {user && (
            <button className="mobile-nav-link mobile-logout" onClick={() => { handleLogout(); setMenuOpen(false); }}>
              🚪 Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
