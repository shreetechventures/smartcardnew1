'use client';

import { useEffect, useState, useRef } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  CreditCard,
  Plus,
  Share2,
  Star,
  Eye,
  Zap,
  X,
  Activity,
} from 'lucide-react';
import { supabase, type Card, type Payment } from '@/lib/supabase';
import { plans as planList } from '@/lib/plans';
import type { NavKey } from '@/components/dashboard-shell';

type AnalyticsEvent = {
  id: string;
  event_type: 'card_view' | 'rating' | 'review_completion';
  rating: number | null;
  created_at: string;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function DashboardView({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [companyPlanId, setCompanyPlanId] = useState<string>('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const [cardsRes, paymentsRes, companyRes, analyticsRes] = await Promise.all([
        supabase.from('cards').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('companies').select('plan_id,subscription_status,subscription_start_at,subscription_expires_at').limit(1).maybeSingle(),
        supabase.from('analytics_events').select('id,event_type,rating,created_at').order('created_at', { ascending: false }).limit(500),
      ]);
      if (!mounted.current) return;
      setCards(cardsRes.data || []);
      setPayments(paymentsRes.data || []);
      if (companyRes.data) setCompanyPlanId(companyRes.data.plan_id || 'starter');
      setAnalyticsEvents((analyticsRes.data as AnalyticsEvent[]) || []);
      setLoading(false);
    };
    loadData();

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics_events' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalCardViews = analyticsEvents.filter(e => e.event_type === 'card_view').length;
  const totalReviews = analyticsEvents.filter(e => e.event_type === 'review_completion').length;
  const ratingEvents = analyticsEvents.filter(e => e.event_type === 'rating' && e.rating !== null);
  const avgRating = ratingEvents.length > 0
    ? (ratingEvents.reduce((s, e) => s + (e.rating || 0), 0) / ratingEvents.length).toFixed(1)
    : '0.0';

  const activeCards = cards.filter(c => c.status === 'active').length;

  const metrics = [
    { label: 'Total Card Views', value: totalCardViews.toLocaleString(), change: `${activeCards} active cards`, icon: Eye, tone: 'violet' },
    { label: 'Review Requests Completed', value: totalReviews.toLocaleString(), change: `${ratingEvents.length} ratings collected`, icon: Star, tone: 'amber' },
    { label: 'Average Customer Rating', value: `${avgRating} ★`, change: `${ratingEvents.length} ratings`, icon: Activity, tone: 'blue' },
  ];

  const handleUpgrade = () => {
    onNavigate('Subscription');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Activity Over Time — from real analytics_events
  const numDays = period === '7' ? 7 : 30;
  const chartPoints: number[] = [];
  const chartLabels: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = daysAgo(i - 1);
    const count = analyticsEvents.filter(e => {
      const d = new Date(e.created_at);
      return d >= dayStart && d < dayEnd;
    }).length;
    chartPoints.push(count);
    if (period === '7') {
      chartLabels.push(dayStart.toLocaleDateString('en-IN', { weekday: 'short' }));
    } else if (i % 5 === 0) {
      chartLabels.push(dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    } else {
      chartLabels.push('');
    }
  }
  const maxChart = Math.max(...chartPoints, 1);
  const line = chartPoints.map((p, i) => `${(i / (chartPoints.length - 1)) * 100}%,${100 - (p / maxChart) * 100}%`).join(' ');
  const area = `0%,100% ${line} 100%,100%`;

  const planFromCompany = planList.find(p => p.id === companyPlanId)?.name;
  const currentPlanName = planFromCompany || 'Starter';

  return (
    <>
      {noticeVisible && (
        <section className="growth-banner">
          <div className="bolt-icon"><Zap size={23} fill="currentColor" /></div>
          <div><h2>You&apos;re missing out on more growth!</h2><p>Upgrade to unlock analytics, payments, priority support & more.</p></div>
          <div className="banner-action"><ArrowUpRight size={34} /><button onClick={handleUpgrade}>Upgrade Now</button><button className="banner-next" aria-label="Next offer"><ArrowUpRight size={19} /></button></div>
          <button className="banner-dismiss" onClick={() => setNoticeVisible(false)} aria-label="Dismiss banner"><X size={15} /></button>
        </section>
      )}

      <div className="metrics-grid metrics-grid-3">
        {metrics.map(({ label, value, change, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
            <div><p>{label}</p><strong>{value}</strong><span>{change}</span></div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel overview-panel">
          <div className="panel-heading"><h2>Activity Over Time</h2>
            <button className="period-select" onClick={() => setPeriod(period === '7' ? '30' : '7')}>{period === '7' ? 'Last 7 Days' : 'Last 30 Days'}<ChevronDown size={15} /></button>
          </div>
          <div className="chart-wrap">
            <div className="chart-y-labels"><span>{maxChart}</span><span>{Math.round(maxChart * 0.75)}</span><span>{Math.round(maxChart * 0.5)}</span><span>{Math.round(maxChart * 0.25)}</span><span>0</span></div>
            <div className="chart-area">
              <div className="chart-grid"><span /><span /><span /><span /><span /></div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" aria-label="Activity overview chart">
                <polygon points={area} className="chart-fill" />
                <polyline points={line} className="chart-line" />
              </svg>
              <div className="chart-dots">{chartPoints.map((p, i) => <span key={i} style={{ left: `${(i / (chartPoints.length - 1)) * 100}%`, top: `${100 - (p / maxChart) * 100}%` }} />)}</div>
            </div>
            <div className="chart-x-labels">{chartLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
          </div>
          <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>Card views, ratings, and review completions per day</p>
        </section>

        <section className="panel plan-panel">
          <div className="panel-heading"><h2>Current Plan</h2></div>
          <span className="plan-chip">{currentPlanName}</span>
          <p className="usage-label"><strong>{cards.length} / {companyPlanId === 'growth' ? '2' : '1'}</strong> Card{companyPlanId === 'growth' ? 's' : ''} Used</p>
          <div className="usage-bar"><span style={{ width: `${Math.min((cards.length / (companyPlanId === 'growth' ? 2 : 1)) * 100, 100)}%` }} /></div>
          <button className="green-button" onClick={handleUpgrade}>Upgrade Plan</button>
        </section>

        <section className="panel recent-panel">
          <div className="panel-heading"><h2>Recent Cards</h2><button className="text-button" onClick={() => onNavigate('My Cards')}>View All</button></div>
          {loading ? (
            <div className="recent-row"><div style={{ color: '#94a3b8', fontSize: 12 }}>Loading...</div></div>
          ) : cards.length === 0 ? (
            <div className="recent-row"><div style={{ color: '#94a3b8', fontSize: 12 }}>No cards yet. Create one to get started.</div></div>
          ) : (
            cards.slice(0, 3).map(card => (
              <div className="recent-row" key={card.id}>
                <div className="recent-avatar bg-slate-900">{initials(card.name)}</div>
                <div><strong>{card.name}</strong><span>{card.handle}</span></div>
                <b>{card.views}<small>Views</small></b>
              </div>
            ))
          )}
        </section>

        <section className="panel actions-panel">
          <div className="panel-heading"><h2>Quick Actions</h2></div>
          <div className="actions-grid">
            <button onClick={() => onNavigate('My Cards')}><span className="action-icon violet"><Plus size={23} /></span>Create New Card</button>
            <button onClick={() => onNavigate('QR Codes')}><span className="action-icon green"><Share2 size={21} /></span>Share Card</button>
            <button onClick={() => onNavigate('QR Codes')}><span className="action-icon amber"><CreditCard size={21} /></span>Download QR</button>
            <button onClick={() => onNavigate('Reviews')}><span className="action-icon blue"><Star size={21} /></span>Manage Reviews</button>
          </div>
        </section>

        <section className="panel payments-panel">
          <div className="panel-heading"><h2>Payment History</h2><button className="text-button" onClick={() => onNavigate('Payments')}>View All</button></div>
          {loading ? (
            <div className="payment-row"><div style={{ color: '#94a3b8', fontSize: 12 }}>Loading...</div></div>
          ) : payments.length === 0 ? (
            <div className="payment-row"><div style={{ color: '#94a3b8', fontSize: 12 }}>No payments yet</div></div>
          ) : (
            payments.map(p => (
              <div className="payment-row" key={p.id}>
                <div><strong>Payment to TheSmartCard</strong><span>{p.plan}</span></div>
                <div><b>&#8377;{Number(p.amount).toLocaleString('en-IN')}</b><em>Paid</em><small>{new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
