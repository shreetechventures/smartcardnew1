'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  CreditCard,
  FileText,
  Globe,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
  Palette,
  QrCode,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  UserPlus,
  Users,
  WalletCards,
  X,
  Check,
  User,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type NavKey =
  | 'Dashboard'
  | 'Business Setup'
  | 'My Cards'
  | 'Leads'
  | 'Analytics'
  | 'Reviews'
  | 'QR Codes'
  | 'Contacts'
  | 'AI Studio'
  | 'Website Builder'
  | 'Marketplace'
  | 'Team'
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
  { label: 'Leads', icon: UserPlus },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Reviews', icon: Star },
  { label: 'QR Codes', icon: QrCode },
  { label: 'Contacts', icon: Users },
  { label: 'AI Studio', icon: Palette },
  { label: 'Website Builder', icon: Globe },
  { label: 'Marketplace', icon: ShoppingBag },
  { label: 'Team', icon: BriefcaseBusiness },
  { label: 'Subscription', icon: WalletCards },
  { label: 'Payments', icon: FileText },
  { label: 'Settings', icon: Settings },
];

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

const notifIcons: Record<string, typeof Bell> = {
  lead: UserPlus,
  review: Star,
  contact: Users,
  payment: Wallet,
  system: Bell,
};

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [profile, setProfile] = useState<{ business_name: string; owner_name: string | null; logo_url: string | null } | null>(null);
  const [planLabel, setPlanLabel] = useState('Starter');
  const [planStatus, setPlanStatus] = useState('trial');
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const [notifRes, leadsRes, reviewsRes, profileRes, companyRes] = await Promise.all([
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('leads').select('id').eq('status', 'new'),
        supabase.from('reviews').select('id'),
        supabase.from('business_profile').select('business_name, owner_name, logo_url').maybeSingle(),
        supabase.from('companies').select('plan_id, subscription_status').maybeSingle(),
      ]);
      setNotifications((notifRes.data as Notification[]) || []);
      setLeadCount(leadsRes.data?.length || 0);
      setReviewCount(reviewsRes.data?.length || 0);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const handleNotifClick = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    setNotifications(notifications.map(item => item.id === n.id ? { ...item, is_read: true } : item));
    if (n.link) onNavigate(n.link as NavKey);
    setNotifOpen(false);
  };

  const handleNav = (key: NavKey) => {
    onNavigate(key);
    setSidebarOpen(false);
  };

  const businessName = profile?.business_name || 'My Business';
  const ownerName = profile?.owner_name || 'Owner';
  const initials = ownerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const getBadge = (label: NavKey): string | null => {
    if (label === 'Leads' && leadCount > 0) return String(leadCount);
    if (label === 'Reviews' && reviewCount > 0) return String(reviewCount);
    return null;
  };

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
        <div className="sidebar-offer">
          <div className="offer-title"><Sparkles size={15} /> Limited Time Offer!</div>
          <p>Upgrade now & get</p><strong>2 Months FREE</strong><p>on Annual Plans</p>
          <button onClick={() => handleNav('Subscription')}>Upgrade Now <ArrowUpRight size={16} /></button>
        </div>
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

          <div className="dropdown-wrapper" ref={notifRef}>
            <button className="icon-button notification" aria-label="Notifications" onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}>
              <Bell size={19} />
              {unreadCount > 0 && <i className="notif-dot">{unreadCount > 9 ? '9+' : unreadCount}</i>}
            </button>
            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <strong>Notifications</strong>
                  {unreadCount > 0 && <button className="notif-mark-all" onClick={markAllRead}><Check size={14} /> Mark all read</button>}
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty"><Bell size={32} /><p>No notifications yet</p></div>
                  ) : (
                    notifications.map(n => {
                      const Icon = notifIcons[n.type] || Bell;
                      return (
                        <button
                          key={n.id}
                          className={`notif-item ${n.is_read ? 'read' : 'unread'}`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className={`notif-icon ${n.type}`}><Icon size={16} /></div>
                          <div className="notif-content">
                            <strong>{n.title}</strong>
                            <span>{n.message}</span>
                            <small>{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                          </div>
                          {!n.is_read && <span className="notif-unread-dot" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="dropdown-wrapper" ref={profileRef}>
            <button className="workspace-button" onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}>
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
