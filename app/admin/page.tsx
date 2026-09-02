'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity, BarChart3, Building2, Check, CreditCard, Download, LayoutDashboard,
  Loader2, Lock, LogOut, Menu, Pencil, Plus, Settings, Shield,
  Star, Trash2, TrendingUp, UserCog, Users, Wallet, X, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { supabase, type Card, type Review, type PlanConfig, type AdminSettings } from '@/lib/supabase';
import { plans as defaultPlans, type PlanInfo, mapPlanConfig } from '@/lib/plans';

type AdminSection = 'overview' | 'companies' | 'users' | 'plans' | 'cards' | 'invoices' | 'reviews' | 'settings';

type Company = {
  id: string;
  name: string;
  plan_id: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  created_at: string;
  member_count: number;
};

type AdminUser = {
  user_id: string;
  email: string;
  full_name: string;
  company_id: string | null;
  company_name: string | null;
  role: string;
  status: string;
  created_at: string;
};

type AdminInvoice = {
  id: string;
  company_id: string;
  company_name: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character] || character));
}

function generateInvoiceHtml(invoice: AdminInvoice): string {
  const date = new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const amount = Number(invoice.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.id.slice(0, 8))}</title><style>body{font-family:Arial,sans-serif;color:#172033;max-width:760px;margin:48px auto;padding:32px;border:1px solid #dbe2ea}h1{margin:0 0 8px;color:#5648db}p{color:#667085}.row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e5e7eb}.total{font-size:20px;font-weight:700}</style></head><body><h1>TheSmartCard</h1><p>Invoice #${escapeHtml(invoice.id.slice(0, 8))}</p><div class="row"><strong>Company</strong><span>${escapeHtml(invoice.company_name)}</span></div><div class="row"><strong>Plan</strong><span>${escapeHtml(invoice.plan_id)}</span></div><div class="row"><strong>Date</strong><span>${escapeHtml(date)}</span></div><div class="row"><strong>Status</strong><span>${escapeHtml(invoice.status)}</span></div><div class="row total"><strong>Total</strong><span>${escapeHtml(invoice.currency)} ${escapeHtml(amount)}</span></div></body></html>`;
}

const navItems: { key: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'plans', label: 'Plans', icon: CreditCard },
  { key: 'cards', label: 'Cards', icon: CreditCard },
  { key: 'invoices', label: 'Invoices', icon: Wallet },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'settings', label: 'Settings', icon: Settings },
];

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [section, setSection] = useState<AdminSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [planConfigs, setPlanConfigs] = useState<PlanInfo[]>(defaultPlans);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<PlanInfo | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [toast, setToast] = useState('');

  const credRef = useRef<{ email: string; hash: string } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_authed');
    const storedEmail = sessionStorage.getItem('admin_email');
    const storedHash = sessionStorage.getItem('admin_hash');
    if (stored === 'true' && storedEmail && storedHash) {
      setAuthed(true);
      credRef.current = { email: storedEmail, hash: storedHash };
    }
    setCheckingAuth(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!credRef.current) return;
    const { email, hash } = credRef.current;

    const [c, r, pc, as, compRes, userRes, invRes] = await Promise.all([
      supabase.from('cards').select('*').order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('plans_config').select('*').order('sort_order', { ascending: true }),
      supabase.from('admin_settings').select('id,admin_email,allow_registrations,auto_approve_cards,maintenance_mode,platform_version,created_at,updated_at').limit(1).maybeSingle(),
      supabase.rpc('admin_get_companies', { p_admin_email: email, p_admin_password_hash: hash }),
      supabase.rpc('admin_get_users', { p_admin_email: email, p_admin_password_hash: hash }),
      supabase.rpc('admin_get_invoices', { p_admin_email: email, p_admin_password_hash: hash }),
    ]);
    setCards((c.data as Card[]) || []);
    setReviews((r.data as Review[]) || []);
    if (pc.data && pc.data.length > 0) setPlanConfigs((pc.data as PlanConfig[]).map(mapPlanConfig));
    if (as.data) setAdminSettings(as.data as AdminSettings);
    setCompanies((compRes.data as Company[]) || []);
    setUsers((userRes.data as AdminUser[]) || []);
    setInvoices((invRes.data as AdminInvoice[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const enteredHash = await sha256(loginPassword);
      const { data: isValid, error } = await supabase.rpc('verify_admin_login', {
        p_email: loginEmail.trim(),
        p_password_hash: enteredHash,
      });
      if (error || !isValid) {
        setLoginError('Invalid email or password.');
        setLoginLoading(false);
        return;
      }
      credRef.current = { email: loginEmail.trim(), hash: enteredHash };
      sessionStorage.setItem('admin_authed', 'true');
      sessionStorage.setItem('admin_email', loginEmail.trim());
      sessionStorage.setItem('admin_hash', enteredHash);
      setAuthed(true);
    } catch {
      setLoginError('Something went wrong. Please try again.');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    setAuthed(false);
    credRef.current = null;
    sessionStorage.removeItem('admin_authed');
    sessionStorage.removeItem('admin_email');
    sessionStorage.removeItem('admin_hash');
  };

  const updateCardStatus = async (cardId: string, status: 'active' | 'inactive') => {
    const { error } = await supabase.from('cards').update({ status, updated_at: new Date().toISOString() }).eq('id', cardId);
    if (error) {
      showToast('Failed to update card status.');
    } else {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status } : c));
      showToast(`Card ${status === 'active' ? 'activated' : 'deactivated'}.`);
    }
  };

  const updateCompanySubscription = async (companyId: string, planId: string, status: string) => {
    if (!credRef.current) return;
    const { error } = await supabase.rpc('admin_update_company_subscription', {
      p_company_id: companyId,
      p_plan_id: planId,
      p_subscription_status: status,
      p_admin_email: credRef.current.email,
      p_admin_password_hash: credRef.current.hash,
    });
    if (error) {
      showToast('Failed to update company.');
    } else {
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, plan_id: planId, subscription_status: status } : c));
      showToast('Company updated.');
    }
  };

  const toggleSuspendCompany = async (companyId: string, currentStatus: string) => {
    if (!credRef.current) return;
    const shouldSuspend = currentStatus !== 'cancelled';
    const { error } = await supabase.rpc('admin_suspend_company', {
      p_company_id: companyId,
      p_suspend: shouldSuspend,
      p_admin_email: credRef.current.email,
      p_admin_password_hash: credRef.current.hash,
    });
    if (error) {
      showToast('Failed to update company.');
    } else {
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, subscription_status: shouldSuspend ? 'cancelled' : 'active' } : c));
      showToast(shouldSuspend ? 'Company suspended.' : 'Company reactivated.');
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    if (!credRef.current) return;
    const { error } = await supabase.rpc('admin_update_user_role', {
      p_user_id: userId,
      p_new_role: newRole,
      p_admin_email: credRef.current.email,
      p_admin_password_hash: credRef.current.hash,
    });
    if (error) {
      showToast('Failed to update user role.');
    } else {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      showToast('User role updated.');
    }
  };

  const updateUserStatus = async (userId: string, newStatus: string) => {
    if (!credRef.current) return;
    const { error } = await supabase.rpc('admin_update_user_status', {
      p_user_id: userId,
      p_new_status: newStatus,
      p_admin_email: credRef.current.email,
      p_admin_password_hash: credRef.current.hash,
    });
    if (error) {
      showToast('Failed to update user status.');
    } else {
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, status: newStatus } : u));
      showToast(`User ${newStatus === 'active' ? 'activated' : 'suspended'}.`);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!credRef.current) return;
    if (!window.confirm('Are you sure? This will permanently remove the user and all their data.')) return;
    const { error } = await supabase.rpc('admin_delete_user', {
      p_user_id: userId,
      p_admin_email: credRef.current.email,
      p_admin_password_hash: credRef.current.hash,
    });
    if (error) {
      showToast('Failed to delete user.');
    } else {
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      showToast('User deleted.');
    }
  };

  const downloadInvoice = (inv: AdminInvoice) => {
    const invoiceHtml = generateInvoiceHtml(inv);
    const blob = new Blob([invoiceHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${inv.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Invoice downloaded.');
  };

  const savePlan = async (plan: PlanInfo) => {
    setSavingPlan(true);
    const { error } = await supabase.from('plans_config').upsert({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      original_price: plan.originalPrice,
      period: plan.period,
      features: plan.features,
      badge: plan.badge || null,
      highlight: plan.highlight || false,
      trial_note: plan.trialNote || null,
      sort_order: defaultPlans.findIndex(p => p.id === plan.id),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      showToast('Failed to save plan.');
    } else {
      setPlanConfigs(prev => {
        const idx = prev.findIndex(p => p.id === plan.id);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = plan; return copy; }
        return [...prev, plan];
      });
      showToast(`${plan.name} plan updated.`);
      setEditingPlan(null);
    }
    setSavingPlan(false);
  };

  const updateAdminToggle = async (key: 'allow_registrations' | 'auto_approve_cards' | 'maintenance_mode', value: boolean) => {
    if (!adminSettings) return;
    const { error } = await supabase.from('admin_settings').update({ [key]: value, updated_at: new Date().toISOString() }).eq('id', adminSettings.id);
    if (error) {
      showToast('Failed to update setting.');
    } else {
      setAdminSettings({ ...adminSettings, [key]: value });
    }
  };

  const updateAdminCredentials = async (email: string, password: string) => {
    if (!adminSettings) return;
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (email && email !== adminSettings.admin_email) updates.admin_email = email;
    if (password) {
      const newHash = await sha256(password);
      updates.admin_password_hash = newHash;
    }
    const { error } = await supabase.from('admin_settings').update(updates).eq('id', adminSettings.id);
    if (error) {
      showToast('Failed to update credentials.');
    } else {
      setAdminSettings({ ...adminSettings, ...updates } as AdminSettings);
      if (email && email !== adminSettings.admin_email) {
        credRef.current = { ...credRef.current!, email };
        sessionStorage.setItem('admin_email', email);
      }
      if (password) {
        const newHash = await sha256(password);
        credRef.current = { ...credRef.current!, hash: newHash };
        sessionStorage.setItem('admin_hash', newHash);
      }
      showToast('Admin credentials updated.');
    }
  };

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const activeCompanies = companies.filter(c => c.subscription_status === 'active').length;
  const trialCompanies = companies.filter(c => c.subscription_status === 'trial').length;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  if (checkingAuth) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card" style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="spin" style={{ color: '#5648db', margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-logo"><Lock size={26} /></div>
          <h1>Admin Access</h1>
          <p className="login-sub">Sign in to manage TheSmartCard platform</p>
          {loginError && <div className="admin-login-error">{loginError}</div>}
          <form className="admin-login-form" onSubmit={handleLogin}>
            <div className="form-field">
              <label>Email Address</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@example.com" required autoFocus />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Enter password" required />
            </div>
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? <><Loader2 size={18} className="spin" /> Verifying...</> : 'Sign In'}
            </button>
          </form>
          <Link href="/" className="admin-login-back">Back to website</Link>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Platform Overview</h2>
                <p className="page-subtitle">Monitor your platform performance at a glance</p>
              </div>
            </div>
            <div className="summary-row">
              <div className="summary-card"><Building2 size={20} /><div><strong>{companies.length}</strong><span>Companies</span></div></div>
              <div className="summary-card"><Activity size={20} /><div><strong>{activeCompanies}</strong><span>Active</span></div></div>
              <div className="summary-card"><Zap size={20} /><div><strong>{trialCompanies}</strong><span>On Trial</span></div></div>
              <div className="summary-card"><Wallet size={20} /><div><strong>&#8377;{totalRevenue.toLocaleString('en-IN')}</strong><span>Revenue</span></div></div>
            </div>
            <div className="summary-row">
              <div className="summary-card"><Users size={20} /><div><strong>{users.length}</strong><span>Total Users</span></div></div>
              <div className="summary-card"><CreditCard size={20} /><div><strong>{cards.length}</strong><span>Total Cards</span></div></div>
              <div className="summary-card"><Star size={20} /><div><strong>{avgRating}</strong><span>Avg Rating</span></div></div>
              <div className="summary-card"><BarChart3 size={20} /><div><strong>{reviews.length}</strong><span>Reviews</span></div></div>
            </div>
            <div className="admin-grid">
              <section className="panel">
                <div className="panel-heading"><h2>Recent Companies</h2></div>
                {companies.slice(0, 5).map(c => (
                  <div className="recent-row" key={c.id}>
                    <div className="recent-avatar">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                    <div><strong>{c.name}</strong><span>{c.plan_id} — {c.subscription_status}</span></div>
                    <b>{c.member_count} members</b>
                  </div>
                ))}
                {companies.length === 0 && <div className="muted" style={{ padding: '16px 0', fontSize: 13, textAlign: 'center' }}>No companies yet.</div>}
              </section>
              <section className="panel">
                <div className="panel-heading"><h2>Plan Distribution</h2></div>
                <div className="admin-plan-dist">
                  {planConfigs.map(p => {
                    const count = companies.filter(c => c.plan_id === p.id).length;
                    const pct = companies.length > 0 ? (count / companies.length) * 100 : 0;
                    return (
                      <div className="admin-plan-bar" key={p.id}>
                        <div className="admin-plan-label"><strong>{p.name}</strong><span>{count} companies</span></div>
                        <div className="h-bar-track"><div className="h-bar-fill" style={{ width: `${pct}%`, background: '#5648db' }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        );

      case 'companies':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Companies</h2>
                <p className="page-subtitle">Manage all companies on the platform</p>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Loading companies...</div>
            ) : companies.length === 0 ? (
              <div className="empty-state"><Building2 size={48} /><h3>No companies yet</h3><p>Companies will appear here when users sign up.</p></div>
            ) : (
              <div className="data-table">
                <table>
                  <thead><tr><th>Company</th><th>Plan</th><th>Members</th><th>Status</th><th>Created</th><th></th></tr></thead>
                  <tbody>
                    {companies.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>
                          <select className="admin-status-select" value={c.plan_id}
                            onChange={e => updateCompanySubscription(c.id, e.target.value, c.subscription_status)}>
                            {planConfigs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td>{c.member_count}</td>
                        <td>
                          <span className={`pay-status pay-${c.subscription_status === 'active' ? 'paid' : c.subscription_status === 'trial' ? 'pending' : 'failed'}`}>
                            <span className="dot" />{c.subscription_status}
                          </span>
                        </td>
                        <td className="muted">{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <button className={`ghost-btn sm ${c.subscription_status !== 'cancelled' ? 'danger' : ''}`}
                            onClick={() => toggleSuspendCompany(c.id, c.subscription_status)}>
                            {c.subscription_status === 'cancelled' ? 'Reactivate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );

      case 'users':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Users</h2>
                <p className="page-subtitle">All users across the platform</p>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="empty-state"><Users size={48} /><h3>No users yet</h3><p>Users will appear here when they sign up.</p></div>
            ) : (
              <div className="data-table">
                <table>
                  <thead><tr><th>User</th><th>Company</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.user_id}>
                        <td>
                          <div className="cell-name">
                            <div className="cell-avatar">{(u.full_name || u.email).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                            <div><strong>{u.full_name || 'Unknown'}</strong><span>{u.email}</span></div>
                          </div>
                        </td>
                        <td>{u.company_name || '—'}</td>
                        <td>
                          <select className="admin-status-select" value={u.role}
                            onChange={e => updateUserRole(u.user_id, e.target.value)}>
                            <option value="trial_user">Trial User</option>
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                        </td>
                        <td>
                          <select className="admin-status-select" value={u.status}
                            onChange={e => updateUserStatus(u.user_id, e.target.value)}>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                        <td className="muted">{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className={`ghost-btn sm ${u.status === 'active' ? 'danger' : ''}`}
                              onClick={() => updateUserStatus(u.user_id, u.status === 'active' ? 'suspended' : 'active')}>
                              {u.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button className="ghost-btn sm danger" title="Delete user"
                              onClick={() => deleteUser(u.user_id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );

      case 'plans':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Plans</h2>
                <p className="page-subtitle">Configure pricing plans and features</p>
              </div>
            </div>
            <div className="lp-pricing-grid admin-plans-grid">
              {planConfigs.map(plan => {
                const count = companies.filter(c => c.plan_id === plan.id).length;
                return (
                  <div className={`lp-plan-card ${plan.highlight ? 'lp-plan-highlight' : ''}`} key={plan.id}>
                    {plan.badge && <span className="lp-plan-badge">{plan.badge}</span>}
                    <h3>{plan.name}</h3>
                    <div className="lp-plan-price">
                      <strong>&#8377;{plan.price.toLocaleString('en-IN')}</strong>
                      <span>/{plan.period}</span>
                    </div>
                    {plan.originalPrice && plan.originalPrice > plan.price && (
                      <div className="lp-plan-original">&#8377;{plan.originalPrice.toLocaleString('en-IN')}/{plan.period}</div>
                    )}
                    {plan.trialNote && <div className="lp-plan-trial">{plan.trialNote}</div>}
                    <ul className="lp-plan-features">
                      {plan.features.map((f, i) => <li key={i}><Check size={15} /> {f}</li>)}
                    </ul>
                    <div className="admin-plan-stat"><strong>{count}</strong> active companies</div>
                    <button className="admin-plan-edit-btn" onClick={() => setEditingPlan(plan)}>
                      <Pencil size={14} /> Edit Plan
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        );

      case 'cards':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">All Cards</h2>
                <p className="page-subtitle">View and manage all cards across the platform</p>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Loading cards...</div>
            ) : cards.length === 0 ? (
              <div className="empty-state"><CreditCard size={48} /><h3>No cards yet</h3><p>Cards created by users will appear here.</p></div>
            ) : (
              <div className="data-table">
                <table>
                  <thead><tr><th>Card Name</th><th>Handle</th><th>Views</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                  <tbody>
                    {cards.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td className="muted">@{c.handle}</td>
                        <td>{c.views}</td>
                        <td>
                          <select className="admin-status-select" value={c.status}
                            onChange={e => updateCardStatus(c.id, e.target.value as 'active' | 'inactive')}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                        <td className="muted">{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td>
                          <button className={`ghost-btn sm ${c.status === 'active' ? 'danger' : ''}`}
                            onClick={() => updateCardStatus(c.id, c.status === 'active' ? 'inactive' : 'active')}>
                            {c.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );

      case 'invoices':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Invoices</h2>
                <p className="page-subtitle">All billing invoices across the platform</p>
              </div>
            </div>
            <div className="summary-row">
              <div className="summary-card"><Wallet size={20} /><div><strong>&#8377;{totalRevenue.toLocaleString('en-IN')}</strong><span>Total Revenue</span></div></div>
              <div className="summary-card"><TrendingUp size={20} /><div><strong>{invoices.length}</strong><span>Total Invoices</span></div></div>
              <div className="summary-card"><Activity size={20} /><div><strong>{invoices.filter(i => i.status === 'pending').length}</strong><span>Pending</span></div></div>
              <div className="summary-card"><CreditCard size={20} /><div><strong>{invoices.filter(i => i.status === 'paid').length}</strong><span>Paid</span></div></div>
            </div>
            {loading ? (
              <div className="empty-state">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="empty-state"><Wallet size={48} /><h3>No invoices yet</h3><p>Platform invoices will appear here.</p></div>
            ) : (
              <div className="data-table">
                <table>
                  <thead><tr><th>Date</th><th>Company</th><th>Plan</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="muted">{new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td><strong>{inv.company_name}</strong></td>
                        <td>{inv.plan_id}</td>
                        <td className="pay-amount">&#8377;{Number(inv.amount).toLocaleString('en-IN')}</td>
                        <td><span className={`pay-status pay-${inv.status}`}><span className="dot" />{inv.status}</span></td>
                        <td>
                          <button className="ghost-btn sm" title="Download invoice"
                            onClick={() => downloadInvoice(inv)}>
                            <Download size={14} /> Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );

      case 'reviews':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Reviews</h2>
                <p className="page-subtitle">Monitor all customer reviews across the platform</p>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="empty-state"><Star size={48} /><h3>No reviews yet</h3><p>Customer reviews will appear here.</p></div>
            ) : (
              <div className="reviews-grid">
                {reviews.map(r => (
                  <div className="review-card" key={r.id}>
                    <div className="review-card-top">
                      <div className="review-avatar">{r.reviewer_name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                      <div className="review-info">
                        <strong>{r.reviewer_name}</strong>
                        <div className="stars-row">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className={i < r.rating ? 'star-filled' : 'star-empty'} />)}</div>
                      </div>
                    </div>
                    <p className="review-comment">{r.comment || 'No comment provided.'}</p>
                    <span className="review-date">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        );

      case 'settings':
        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">Admin Settings</h2>
                <p className="page-subtitle">Configure platform-wide settings and admin credentials</p>
              </div>
            </div>
            <div className="settings-layout">
              <section className="panel settings-profile-panel">
                <div className="panel-heading"><h2>Platform Settings</h2></div>
                <div className="settings-toggle-list">
                  <div className="settings-toggle-row">
                    <div><strong>Allow New Registrations</strong><span>Let new users sign up for the platform</span></div>
                    <button className={`settings-toggle ${adminSettings?.allow_registrations ? 'toggle-on' : ''}`}
                      onClick={() => updateAdminToggle('allow_registrations', !adminSettings?.allow_registrations)}><span className="toggle-knob" /></button>
                  </div>
                  <div className="settings-toggle-row">
                    <div><strong>Auto-Approve Cards</strong><span>Automatically approve new cards without review</span></div>
                    <button className={`settings-toggle ${adminSettings?.auto_approve_cards ? 'toggle-on' : ''}`}
                      onClick={() => updateAdminToggle('auto_approve_cards', !adminSettings?.auto_approve_cards)}><span className="toggle-knob" /></button>
                  </div>
                  <div className="settings-toggle-row">
                    <div><strong>Maintenance Mode</strong><span>Temporarily disable access to the platform</span></div>
                    <button className={`settings-toggle ${adminSettings?.maintenance_mode ? 'toggle-on' : ''}`}
                      onClick={() => updateAdminToggle('maintenance_mode', !adminSettings?.maintenance_mode)}><span className="toggle-knob" /></button>
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading"><h2>Platform Info</h2></div>
                <div className="settings-profile-details">
                  <div className="settings-detail-row"><span>Platform Version</span><strong>{adminSettings?.platform_version || 'v2.4.0'}</strong></div>
                  <div className="settings-detail-row"><span>Total Companies</span><strong>{companies.length}</strong></div>
                  <div className="settings-detail-row"><span>Total Users</span><strong>{users.length}</strong></div>
                  <div className="settings-detail-row"><span>Active Subscriptions</span><strong>{companies.filter(c => c.subscription_status === 'active').length}</strong></div>
                </div>
              </section>
            </div>
            <AdminCredentialsSection currentEmail={adminSettings?.admin_email || ''} onSave={updateAdminCredentials} showToast={showToast} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-shell admin-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Shield size={22} /></div>
          <div><strong>Admin Panel</strong><span>TheSmartCard</span></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="nav-list" aria-label="Admin navigation">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${section === key ? 'active' : ''}`} onClick={() => { setSection(key); setSidebarOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar">AD</div>
          <div><strong>Admin</strong><span>Super Admin</span></div>
          <button onClick={handleLogout} aria-label="Logout" style={{ border: 0, background: 'transparent', color: '#9caaca', cursor: 'pointer', padding: 4 }}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="welcome">
            <h1>Admin Dashboard</h1>
            <p>Manage your TheSmartCard platform</p>
          </div>
          <div className="topbar-spacer" />
          <Link href="/" className="ghost-btn" style={{ fontSize: 12, padding: '8px 14px' }}>View Site</Link>
          <Link href="/dashboard" className="ghost-btn" style={{ fontSize: 12, padding: '8px 14px' }}>User Dashboard</Link>
        </header>
        <div className="page-content">{renderSection()}</div>
      </main>

      {editingPlan && (
        <PlanEditModal plan={editingPlan} onClose={() => setEditingPlan(null)} onSave={savePlan} saving={savingPlan} />
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  );
}

function PlanEditModal({ plan, onClose, onSave, saving }: { plan: PlanInfo; onClose: () => void; onSave: (p: PlanInfo) => void; saving: boolean }) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [originalPrice, setOriginalPrice] = useState(String(plan.originalPrice || ''));
  const [period, setPeriod] = useState(plan.period);
  const [features, setFeatures] = useState<string[]>(plan.features);
  const [badge, setBadge] = useState(plan.badge || '');
  const [highlight, setHighlight] = useState(plan.highlight || false);
  const [trialNote, setTrialNote] = useState(plan.trialNote || '');
  const [newFeature, setNewFeature] = useState('');

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      ...plan,
      name,
      price: Number(price) || 0,
      originalPrice: originalPrice ? Number(originalPrice) : null,
      period,
      features,
      badge: badge || undefined,
      highlight,
      trialNote: trialNote || undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit {plan.name} Plan</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-field">
              <label>Plan Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Period</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="year">year</option>
                <option value="month">month</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Price (&#8377;)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" />
            </div>
            <div className="form-field">
              <label>Original Price (&#8377;) — for showing discount</label>
              <input type="number" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} min="0" placeholder="Optional" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Badge Text (e.g. BEST VALUE)</label>
              <input type="text" value={badge} onChange={e => setBadge(e.target.value)} placeholder="Optional" />
            </div>
            <div className="form-field">
              <label>Trial Note</label>
              <input type="text" value={trialNote} onChange={e => setTrialNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="form-field">
            <label>
              <input type="checkbox" checked={highlight} onChange={e => setHighlight(e.target.checked)} style={{ marginRight: 8 }} />
              Highlight this plan (featured border)
            </label>
          </div>
          <div className="form-field">
            <label>Features</label>
            <div className="admin-features-editor">
              {features.map((f, i) => (
                <div className="admin-feature-row" key={i}>
                  <input type="text" value={f} onChange={e => setFeatures(features.map((feat, idx) => idx === i ? e.target.value : feat))} />
                  <button className="admin-feature-remove" onClick={() => removeFeature(i)}><Trash2 size={16} /></button>
                </div>
              ))}
              <div className="admin-feature-row">
                <input type="text" value={newFeature} onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }} placeholder="Add a feature..." />
                <button className="admin-feature-add" onClick={addFeature}><Plus size={14} /> Add</button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminCredentialsSection({ currentEmail, onSave, showToast }: { currentEmail: string; onSave: (email: string, password: string) => void; showToast: (msg: string) => void }) {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!email.trim()) { showToast('Email cannot be empty.'); return; }
    if (password && password.length < 6) { showToast('Password must be at least 6 characters.'); return; }
    setSaving(true);
    onSave(email.trim(), password);
    setPassword('');
    setSaving(false);
  };

  return (
    <section className="panel" style={{ marginTop: '20px' }}>
      <div className="panel-heading"><h2>Admin Credentials</h2></div>
      <div className="form-row">
        <div className="form-field">
          <label>Admin Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" />
        </div>
        <div className="form-field">
          <label>New Password (leave blank to keep current)</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter new password" />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : 'Update Credentials'}
        </button>
      </div>
    </section>
  );
}
