'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  CreditCard,
  Plus,
  QrCode,
  Share2,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Star,
  Headphones,
  Zap,
  X,
} from 'lucide-react';
import { supabase, type Card, type Payment, type Contact, type Lead, type Review } from '@/lib/supabase';
import type { NavKey } from '@/components/dashboard-shell';

type Metric = {
  label: string;
  value: string;
  change: string;
  icon: typeof Activity;
  tone: string;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function countInPeriod(items: { created_at: string }[], days: number): number {
  const cutoff = daysAgo(days);
  return items.filter(i => new Date(i.created_at) >= cutoff).length;
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'New' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

export function DashboardView({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const [cardsRes, paymentsRes, contactsRes, leadsRes, reviewsRes] = await Promise.all([
        supabase.from('cards').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      ]);
      if (!mounted.current) return;
      setCards(cardsRes.data || []);
      setPayments(paymentsRes.data || []);
      setContacts(contactsRes.data || []);
      setLeads(leadsRes.data || []);
      setReviews(reviewsRes.data || []);
      setLoading(false);
    };
    loadData();

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const periodDays = period === '7' ? 7 : 30;
  const prevPeriodDays = period === '7' ? 14 : 60;

  const totalViews = cards.reduce((sum, c) => sum + c.views, 0);
  const activeCards = cards.filter(c => c.status === 'active').length;
  const cardsWithPhone = cards.filter(c => c.phone).length;
  const cardsWithWhatsapp = cards.filter(c => c.whatsapp).length;

  const leadsThisPeriod = countInPeriod(leads, periodDays);
  const leadsPrevPeriod = countInPeriod(leads, prevPeriodDays) - leadsThisPeriod;
  const contactsThisPeriod = countInPeriod(contacts, periodDays);
  const contactsPrevPeriod = countInPeriod(contacts, prevPeriodDays) - contactsThisPeriod;
  const reviewsThisPeriod = countInPeriod(reviews, periodDays);
  const reviewsPrevPeriod = countInPeriod(reviews, prevPeriodDays) - reviewsThisPeriod;

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const newLeads = leads.filter(l => l.status === 'new').length;

  const metrics: Metric[] = [
    { label: 'Card Views', value: totalViews.toLocaleString(), change: `${activeCards} active cards`, icon: Activity, tone: 'violet' },
    { label: 'Leads', value: leads.length.toString(), change: `${newLeads} new`, icon: UserPlus, tone: 'slate' },
    { label: 'Contacts', value: contacts.length.toString(), change: pctChange(contactsThisPeriod, contactsPrevPeriod), icon: Activity, tone: 'blue' },
    { label: 'Reviews', value: reviews.length.toString(), change: `${avgRating} avg`, icon: Star, tone: 'amber' },
    { label: 'Active Cards', value: activeCards.toString(), change: `${cards.length} total`, icon: CreditCard, tone: 'green' },
    { label: 'Conversion', value: leads.length > 0 ? `${Math.round((leads.filter(l => l.status === 'converted').length / leads.length) * 100)}%` : '0%', change: `${leads.filter(l => l.status === 'converted').length} converted`, icon: TrendingUp, tone: 'indigo' },
  ];

  const handleUpgrade = () => { onNavigate('Subscription'); };
  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Build chart from real data: group leads+contacts+reviews by day
  const allEvents = [
    ...leads.map(l => ({ date: new Date(l.created_at) })),
    ...contacts.map(c => ({ date: new Date(c.created_at) })),
    ...reviews.map(r => ({ date: new Date(r.created_at) })),
  ];

  const chartPoints: number[] = [];
  const chartLabels: string[] = [];
  const numDays = period === '7' ? 7 : 30;
  for (let i = numDays - 1; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = daysAgo(i - 1);
    const count = allEvents.filter(e => e.date >= dayStart && e.date < dayEnd).length;
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

  // Determine current plan from latest paid payment
  const paidPayments = payments.filter(p => p.status === 'paid');
  const currentPlanName = paidPayments.length > 0 ? paidPayments[0].plan : 'Starter';

  return (
    <>
      {noticeVisible && (
        <section className="growth-banner">
          <div className="bolt-icon"><Zap size={23} fill="currentColor" /></div>
          <div><h2>You&apos;re missing out on more growth!</h2><p>Upgrade to unlock more cards, advanced analytics, lead export, team access & more.</p></div>
          <div className="banner-action"><ArrowUpRight size={34} /><button onClick={handleUpgrade}>Upgrade Now</button><button className="banner-next" aria-label="Next offer"><ArrowUpRight size={19} /></button></div>
          <button className="banner-dismiss" onClick={() => setNoticeVisible(false)} aria-label="Dismiss banner"><X size={15} /></button>
        </section>
      )}

      <div className="metrics-grid">
        {metrics.map(({ label, value, change, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
            <div><p>{label}</p><strong>{value}</strong><span><TrendingUp size={13} /> {change}</span></div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel overview-panel">
          <div className="panel-heading"><h2>Overview</h2>
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
          <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>Shows leads, contacts, and reviews per day from real data</p>
        </section>

        <section className="panel potential-panel">
          <div>
            <h2>Unlock Your Business Potential <span>✦</span></h2>
            <p>Upgrade your plan and get access to:</p>
            <ul>{['Up to 5 Smart Cards', 'Advanced Analytics', 'AI Review Management', 'Team Members', 'Custom Branding', 'Priority Support'].map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
            <button className="gradient-button" onClick={handleUpgrade}>Upgrade Now <ArrowUpRight size={17} /></button>
            <small>Starting from &#8377;1,999/year</small>
          </div>
          <div className="card-orbit"><CreditCard size={35} /><span>BUSINESS</span></div>
        </section>

        <section className="panel plan-panel">
          <div className="panel-heading"><h2>Current Plan</h2></div>
          <span className="plan-chip">{currentPlanName}</span>
          <p className="usage-label"><strong>{cards.length} / {currentPlanName === 'Pro' ? '5' : currentPlanName === 'Growth' ? '3' : currentPlanName === 'Business' ? '2' : '1'}</strong> Cards Used</p>
          <div className="usage-bar"><span style={{ width: `${Math.min((cards.length / 5) * 100, 100)}%` }} /></div>
          <ul className="plan-list">
            {['Basic Analytics', '1 Business Card', 'Lead Export', 'Team Members', 'Custom Branding'].map((item, i) => (
              <li key={item} className={i > 1 ? 'locked' : ''}><Check size={15} />{item}{i > 1 && <ShieldCheck size={14} />}</li>
            ))}
          </ul>
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
            <button onClick={() => onNavigate('QR Codes')}><span className="action-icon amber"><QrCode size={21} /></span>Download QR</button>
            <button onClick={() => onNavigate('Leads')}><span className="action-icon blue"><UserPlus size={21} /></span>Add Lead</button>
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

        <section className="growth-card">
          <div className="avatar-stack"><span>SJ</span><span>MK</span><span>RA</span><span>NP</span><b>+997</b></div>
          <h2>Don&apos;t just share your card,<br />Grow your business.</h2>
          <p>Join 1000+ businesses already growing faster with TheSmartCard.</p>
          <button onClick={handleUpgrade}>Upgrade Now & Grow <ArrowUpRight size={17} /></button>
        </section>
      </div>
    </>
  );
}
