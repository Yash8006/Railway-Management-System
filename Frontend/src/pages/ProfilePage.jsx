import { useState, useEffect } from 'react';
import { updateProfile, getCoPassengers, addCoPassenger, updateCoPassenger, deleteCoPassenger } from '../api/api.js';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const blankCp = () => ({ name: '', age: '', gender: 'male', idProofType: 'Aadhaar', idProofNumber: '' });

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', password: '' });
  const [saving, setSaving] = useState(false);
  const [coPassengers, setCoPassengers] = useState([]);
  const [cpForm, setCpForm] = useState(blankCp());
  const [editingCp, setEditingCp] = useState(null);
  const [cpModal, setCpModal] = useState(false);
  const [loadingCp, setLoadingCp] = useState(true);

  useEffect(() => {
    if (tab === 'co-passengers') loadCp();
  }, [tab]);

  const loadCp = async () => {
    setLoadingCp(true);
    try { const r = await getCoPassengers(); setCoPassengers(r.data.data || []); }
    catch { addToast('Failed to load co-passengers', 'error'); }
    finally { setLoadingCp(false); }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      await updateProfile(payload);
      await refreshUser();
      addToast('Profile updated successfully!', 'success');
      setForm((p) => ({ ...p, password: '' }));
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed', 'error');
    } finally { setSaving(false); }
  };

  const openAddCp = () => { setCpForm(blankCp()); setEditingCp(null); setCpModal(true); };
  const openEditCp = (cp) => {
    setCpForm({ name: cp.name, age: cp.age, gender: cp.gender, idProofType: cp.idProofType, idProofNumber: cp.idProofNumber });
    setEditingCp(cp._id);
    setCpModal(true);
  };

  const saveCp = async (e) => {
    e.preventDefault();
    try {
      if (editingCp) { await updateCoPassenger(editingCp, cpForm); addToast('Co-passenger updated', 'success'); }
      else { await addCoPassenger({ ...cpForm, age: Number(cpForm.age) }); addToast('Co-passenger added', 'success'); }
      setCpModal(false);
      loadCp();
    } catch (err) { addToast(err.response?.data?.message || 'Failed to save', 'error'); }
  };

  const deleteCp = async (id) => {
    try { await deleteCoPassenger(id); addToast('Co-passenger removed', 'success'); loadCp(); }
    catch { addToast('Failed to delete', 'error'); }
  };

  const ID_PROOFS = ['Aadhaar', 'Passport', 'PAN', 'Voter ID', 'Driving License'];

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="flex items-center gap-md">
          <div className="user-avatar" style={{ width: 56, height: 56, fontSize: '1.5rem', borderRadius: '50%', background: 'linear-gradient(135deg, var(--clr-primary), var(--clr-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{user?.name}</h1>
            <p className="page-subtitle">{user?.email} &nbsp;·&nbsp; <span className={`badge badge-${user?.role === 'admin' ? 'orange' : 'green'}`}>{user?.role}</span></p>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>👤 Profile</button>
        <button className={`tab-btn ${tab === 'co-passengers' ? 'active' : ''}`} onClick={() => setTab('co-passengers')}>👥 Co-Passengers</button>
      </div>

      {tab === 'profile' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h2 className="section-title" style={{ marginBottom: 'var(--sp-lg)' }}>Edit Profile</h2>
          <form onSubmit={handleProfileSave} className="flex flex-col gap-md">
            <div className="form-group">
              <label className="form-label">👤 Full Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">📧 Email</label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">🔒 New Password <span className="text-faint">(leave blank to keep current)</span></label>
              <input className="form-input" type="password" placeholder="New password (min 6 chars)" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : '💾 Save Changes'}
            </button>
          </form>
        </div>
      )}

      {tab === 'co-passengers' && (
        <div>
          <div className="section-header">
            <h2 className="section-title">Saved Travellers</h2>
            <button className="btn btn-primary btn-sm" onClick={openAddCp}>+ Add Traveller</button>
          </div>

          {loadingCp ? (
            <div className="spinner-center"><div className="spinner" /></div>
          ) : coPassengers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">👥</span>
              <h3>No saved co-passengers</h3>
              <p>Add frequent travellers for quick checkout during booking.</p>
            </div>
          ) : (
            <div className="grid-3">
              {coPassengers.map((cp) => (
                <div key={cp._id} className="card">
                  <div className="flex items-center gap-md" style={{ marginBottom: 'var(--sp-sm)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--clr-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--clr-text-muted)' }}>
                      {cp.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{cp.name}</div>
                      <div className="text-muted text-sm">{cp.age} yrs · {cp.gender}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted" style={{ marginBottom: 'var(--sp-md)' }}>
                    🪪 {cp.idProofType}: {cp.idProofNumber}
                  </div>
                  <div className="flex gap-sm">
                    <button className="btn btn-ghost btn-sm flex-1" onClick={() => openEditCp(cp)}>✏️ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteCp(cp._id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {cpModal && (
        <div className="modal-overlay" onClick={() => setCpModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCp ? 'Edit' : 'Add'} Co-Passenger</h2>
              <button className="modal-close" onClick={() => setCpModal(false)}>✕</button>
            </div>
            <form onSubmit={saveCp} className="flex flex-col gap-md">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" required value={cpForm.name} onChange={(e) => setCpForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full Name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Age *</label>
                  <input className="form-input" type="number" required min={0} max={120} value={cpForm.age} onChange={(e) => setCpForm((p) => ({ ...p, age: e.target.value }))} placeholder="Age" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <select className="form-select" value={cpForm.gender} onChange={(e) => setCpForm((p) => ({ ...p, gender: e.target.value }))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ID Proof Type *</label>
                  <select className="form-select" value={cpForm.idProofType} onChange={(e) => setCpForm((p) => ({ ...p, idProofType: e.target.value }))}>
                    {ID_PROOFS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">ID Number *</label>
                <input className="form-input" required value={cpForm.idProofNumber} onChange={(e) => setCpForm((p) => ({ ...p, idProofNumber: e.target.value }))} placeholder="ID document number" />
              </div>
              <div className="flex gap-md">
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setCpModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
