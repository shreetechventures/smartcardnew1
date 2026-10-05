'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  FileText,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
  QrCode,
  Settings,
  Sparkles,
  Star,
  Store,
  WalletCards,
  X,
  User,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type NavKey =
  | 'Dashboard'
  | 'Business Setup'
  | 'My Cards'
  | 'Analytics'
  | 'Reviews'
  | 'QR Codes'
  | 'Subscription'
  | 'Payments'
  | 'Settings';

type NavItem = {
  label: NavKey;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Business Setup', icon: Store },
  { label: 'My Cards', icon: CreditCard },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Reviews', icon: Star },
  { label: 'QR Codes', icon: QrCode },
  { label: 'Subscription', icon: WalletCards },
  { label: 'Payments', icon: FileText },
  { label: 'Settings', icon: Settings },
];


export function DashboardShell({
  active,
  onNavigate,
  children,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<{ business_name: string; owner_name: string | null; logo_url: string | null } | null>(null);
  const [planLabel, setPlanLabel] = useState('Starter');
  const [planStatus, setPlanStatus] = useState('trial');
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const [profileRes, companyRes] = await Promise.all([
        supabase.from('business_profile').select('business_name, owner_name, logo_url').maybeSingle(),
        supabase.from('companies').select('plan_id, subscription_status, subscription_start_at, subscription_expires_at').maybeSingle(),
      ]);
      setProfile(profileRes.data as typeof profile);
      const companyData = companyRes.data as { plan_id: string; subscription_status: string } | null;
      if (companyData) {
        const planNames: Record<string, string> = { starter: 'Starter', business: 'Business', growth: 'Growth', pro: 'Pro' };
        setPlanLabel(planNames[companyData.plan_id] || 'Starter');
        setPlanStatus(companyData.subscription_status);
      }
    };
    loadData();

    const channel = supabase
      .channel('navbar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_profile' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNav = (key: NavKey) => {
    onNavigate(key);
    setSidebarOpen(false);
  };

  const businessName = profile?.business_name || 'My Business';
  const ownerName = profile?.owner_name || 'Owner';
  const initials = ownerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const getBadge = (label: NavKey): string | null => null;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><CreditCard size={22} /></div>
          <div><strong>TheSmartCard</strong><span>Smart Identity, Smart Business</span></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => {
            const badge = getBadge(label);
            return (
              <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => handleNav(label)}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
                {badge && <b className={`nav-badge ${label === 'Reviews' ? 'green' : ''}`}>{badge}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user" onClick={() => handleNav('Settings')} style={{ cursor: 'pointer' }}>
          <div className="user-avatar">{initials}</div>
          <div><strong>{ownerName}</strong><span>{planLabel}{planStatus === 'trial' ? ' (Trial)' : ''}</span></div>
          <MoreVertical size={18} />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="welcome">
            <h1>Welcome back, {ownerName.split(' ')[0]} <span className="wave">⌁</span></h1>
            <p>Track, manage & grow your business with TheSmartCard</p>
          </div>
          <div className="topbar-spacer" />
          <button className="top-upgrade" onClick={() => handleNav('Subscription')}><Sparkles size={15} /><span>Upgrade Now & Unlock All Features</span><b>Buy Now</b></button>

          <div className="dropdown-wrapper" ref={profileRef}>
            <button className="workspace-button" onClick={() => { setProfileOpen(!profileOpen); }}>
              <span className="workspace-icon">
                {profile?.logo_url ? <img src={profile.logo_url} alt={businessName} style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} /> : <Grid2X2 size={17} />}
              </span>
              <span><strong>{businessName}</strong><small>{planLabel} Plan{planStatus === 'trial' ? ' · Trial' : ''}</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">{initials}</div>
                  <div><strong>{ownerName}</strong><span>{businessName}</span></div>
                </div>
                <button onClick={() => { handleNav('Settings'); setProfileOpen(false); }}><User size={16} /> Profile & Settings</button>
                <button onClick={() => { handleNav('Business Setup'); setProfileOpen(false); }}><Store size={16} /> Business Setup</button>
                <button onClick={() => { handleNav('Subscription'); setProfileOpen(false); }}><WalletCards size={16} /> Subscription</button>
                <button onClick={() => { handleNav('Payments'); setProfileOpen(false); }}><Wallet size={16} /> Payments</button>
                <div className="profile-dropdown-divider" />
                <button className="danger" onClick={() => { signOut(); }}><LogOut size={16} /> Sign Out</button>
              </div>
            )}
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
