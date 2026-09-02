'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, CreditCard, Download, Globe, Moon, Pencil, Shield, User, X, KeyRound, Smartphone, Palette, Building2 } from 'lucide-react';
import { supabase, type Card, type UserSettings } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';
import { useAuth } from '@/lib/auth-context';

export function SettingsView() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    (async () => {
      const { data: cardsData } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
      setCards(cardsData || []);

      let query = supabase.from('user_settings').select('*');
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data: settingsData } = await query.limit(1).maybeSingle();

      if (settingsData) {
        const s = settingsData as UserSettings;
        setSettings(s);
        setForm({ name: s.name, email: s.email, phone: s.phone, company: s.company, bio: s.bio });
      } else if (user) {
        // Create a settings row for this user if none exists
        const { data: newSettings } = await supabase.from('user_settings').insert({
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          phone: '',
          company: '',
          bio: '',
          company_id: companyId,
        }).select('*').single();

        if (newSettings) {
          const s = newSettings as UserSettings;
          setSettings(s);
          setForm({ name: s.name, email: s.email, phone: s.phone, company: s.company, bio: s.bio });
        }
      }
      setLoading(false);
    })();
  }, [companyId, user]);

  const saveProfile = async () => {
    if (!settings) return;
    const { error } = await supabase.from('user_settings').update({
      name: form.name, email: form.email, phone: form.phone, company: form.company, bio: form.bio,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);
    if (error) { showToast('Failed to save profile'); return; }
    setSettings({ ...settings, name: form.name, email: form.email, phone: form.phone, company: form.company, bio: form.bio });
    setEditing(false);
    showToast('Profile updated successfully');
  };

  const toggleNotification = async (key: 'email_alerts' | 'lead_alerts' | 'review_alerts' | 'weekly_report') => {
    if (!settings) return;
    const newValue = !settings[key];
    const { error } = await supabase.from('user_settings').update({ [key]: newValue, updated_at: new Date().toISOString() }).eq('id', settings.id);
    if (error) { showToast('Failed to update'); return; }
    setSettings({ ...settings, [key]: newValue });
  };

  const togglePreference = async (key: 'dark_mode') => {
    if (!settings) return;
    const newValue = !settings[key];
    const { error } = await supabase.from('user_settings').update({ [key]: newValue, updated_at: new Date().toISOString() }).eq('id', settings.id);
    if (error) { showToast('Failed to update'); return; }
    setSettings({ ...settings, [key]: newValue });
    showToast(`${key === 'dark_mode' ? 'Dark mode' : 'Preference'} ${newValue ? 'enabled' : 'disabled'}`);
  };

  const updatePreference = async (key: 'language' | 'timezone', value: string) => {
    if (!settings) return;
    const { error } = await supabase.from('user_settings').update({ [key]: value, updated_at: new Date().toISOString() }).eq('id', settings.id);
    if (error) { showToast('Failed to update'); return; }
    setSettings({ ...settings, [key]: value });
  };

  const changePassword = async () => {
    if (!passwordForm.new || passwordForm.new.length < 6) {
      showToast('Password must be at least 6 characters');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      showToast('Passwords do not match');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
    if (error) {
      showToast(error.message || 'Failed to change password');
      return;
    }
    setPasswordForm({ current: '', new: '', confirm: '' });
    showToast('Password changed successfully');
  };

  const exportData = async () => {
    const [cardsRes, contactsRes, leadsRes, reviewsRes] = await Promise.all([
      supabase.from('cards').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('leads').select('*'),
      supabase.from('reviews').select('*'),
    ]);
    const exportObj = {
      profile: settings,
      cards: cardsRes.data,
      contacts: contactsRes.data,
      leads: leadsRes.data,
      reviews: reviewsRes.data,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thesmartcard-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully');
  };

  const initials = (settings?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (loading) return <div className="empty-state">Loading settings...</div>;
  if (!settings) return <div className="empty-state">Unable to load settings. Please try refreshing the page.</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Configure your account and preferences</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Profile Section */}
        <section className="panel settings-profile-panel">
          <div className="panel-heading"><h2><User size={18} /> Profile</h2></div>
          <div className="settings-profile">
            <div className="settings-avatar">{initials}</div>
            <div className="settings-profile-info">
              <strong>{settings.name}</strong>
              <span>{settings.email}</span>
              <button className="ghost-btn" style={{ marginTop: '10px', fontSize: 12 }} onClick={() => { setForm({ name: settings.name, email: settings.email, phone: settings.phone, company: settings.company, bio: settings.bio }); setEditing(true); }}>
                <Pencil size={13} /> Edit Profile
              </button>
            </div>
          </div>
          {!editing ? (
            <div className="settings-profile-details">
              <div className="settings-detail-row"><span>Phone</span><strong>{settings.phone || 'Not set'}</strong></div>
              <div className="settings-detail-row"><span>Company</span><strong>{settings.company || 'Not set'}</strong></div>
              <div className="settings-detail-row"><span>Bio</span><strong>{settings.bio || 'Not set'}</strong></div>
              <div className="settings-detail-row"><span>Total Cards</span><strong>{cards.length}</strong></div>
            </div>
          ) : (
            <div className="settings-edit-form">
              <div className="form-field">
                <label>Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div className="form-field">
                  <label>Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Your company name" />
                </div>
              </div>
              <div className="form-field">
                <label>Bio</label>
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Tell us about yourself" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button className="ghost-btn" onClick={() => setEditing(false)}>Cancel</button>
                <button className="primary-btn" onClick={saveProfile}>Save Changes</button>
              </div>
            </div>
          )}
        </section>

        {/* Notifications Section */}
        <section className="panel">
          <div className="panel-heading"><h2><Bell size={18} /> Notifications</h2></div>
          <div className="settings-toggle-list">
            {[
              { key: 'email_alerts' as const, label: 'Email Alerts', desc: 'Receive important account emails' },
              { key: 'lead_alerts' as const, label: 'Lead Notifications', desc: 'Get notified when a new lead is captured' },
              { key: 'review_alerts' as const, label: 'Review Notifications', desc: 'Get notified when you receive a review' },
              { key: 'weekly_report' as const, label: 'Weekly Report', desc: 'Summary of your account activity' },
            ].map(item => (
              <div className="settings-toggle-row" key={item.key}>
                <div><strong>{item.label}</strong><span>{item.desc}</span></div>
                <button
                  className={`settings-toggle ${settings[item.key] ? 'toggle-on' : ''}`}
                  onClick={() => toggleNotification(item.key)}
                  aria-label={`Toggle ${item.label}`}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Preferences Section */}
        <section className="panel">
          <div className="panel-heading"><h2><Globe size={18} /> Preferences</h2></div>
          <div className="settings-toggle-list">
            <div className="settings-toggle-row">
              <div><strong>Dark Mode</strong><span>Switch between light and dark themes</span></div>
              <button
                className={`settings-toggle ${settings.dark_mode ? 'toggle-on' : ''}`}
                onClick={() => togglePreference('dark_mode')}
                aria-label="Toggle dark mode"
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <div className="settings-detail-row">
              <span><Globe size={15} /> Language</span>
              <select className="settings-select" value={settings.language} onChange={e => updatePreference('language', e.target.value)}>
                <option>English</option>
                <option>हिन्दी (Hindi)</option>
                <option>தமிழ் (Tamil)</option>
                <option>తెలుగు (Telugu)</option>
                <option>ಕನ್ನಡ (Kannada)</option>
                <option>मराठी (Marathi)</option>
                <option>বাংলা (Bengali)</option>
                <option>ગુજરાતી (Gujarati)</option>
              </select>
            </div>
            <div className="settings-detail-row">
              <span><Moon size={15} /> Timezone</span>
              <select className="settings-select" value={settings.timezone} onChange={e => updatePreference('timezone', e.target.value)}>
                <option>Asia/Kolkata (IST)</option>
                <option>America/New_York (EST)</option>
                <option>America/Los_Angeles (PST)</option>
                <option>Europe/London (GMT)</option>
                <option>Asia/Dubai (GST)</option>
                <option>Asia/Singapore (SGT)</option>
                <option>Asia/Tokyo (JST)</option>
                <option>Australia/Sydney (AEST)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Password / Security */}
        <section className="panel">
          <div className="panel-heading"><h2><KeyRound size={18} /> Password & Security</h2></div>
          <div className="settings-password-form">
            <div className="form-field">
              <label>New Password</label>
              <input type="password" value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })} placeholder="Enter new password" />
            </div>
            <div className="form-field">
              <label>Confirm New Password</label>
              <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Re-enter new password" />
            </div>
            <button className="primary-btn" onClick={changePassword} disabled={!passwordForm.new || !passwordForm.confirm}>
              <KeyRound size={15} /> Update Password
            </button>
          </div>
        </section>

        {/* Account & Data */}
        <section className="panel settings-danger-panel">
          <div className="panel-heading"><h2><Shield size={18} /> Security & Data</h2></div>
          <div className="settings-danger-list">
            <div className="settings-danger-row">
              <div><strong>Export Data</strong><span>Download all your account data as JSON</span></div>
              <button className="ghost-btn" onClick={exportData}><Download size={14} /> Export</button>
            </div>
            <div className="settings-danger-row">
              <div><strong>Two-Factor Authentication</strong><span>Add an extra layer of security to your account</span></div>
              <button className="ghost-btn" onClick={() => showToast('2FA setup coming soon')}>Enable</button>
            </div>
            <div className="settings-danger-row danger">
              <div><strong>Delete Account</strong><span>Permanently remove your account and data</span></div>
              <button className="danger-btn" onClick={() => showToast('Contact admin to delete account')}>Delete</button>
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="panel">
          <div className="panel-heading"><h2><Building2 size={18} /> Account Info</h2></div>
          <div className="settings-profile-details">
            <div className="settings-detail-row"><span>Account Email</span><strong>{user?.email || settings.email}</strong></div>
            <div className="settings-detail-row"><span>User ID</span><strong style={{ fontSize: 11, wordBreak: 'break-all' }}>{user?.id || 'N/A'}</strong></div>
            <div className="settings-detail-row"><span>Member Since</span><strong>{new Date(settings.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
            <div className="settings-detail-row"><span>Last Updated</span><strong>{new Date(settings.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
          </div>
        </section>
      </div>

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
