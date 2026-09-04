'use client';

import { useEffect, useState, useRef } from 'react';
import { Activity, BarChart3, Download, Eye, Star, TrendingUp, UserPlus } from 'lucide-react';
import { supabase, type Card, type Contact, type Lead, type Review } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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

export function AnalyticsView() {
  const { companyId } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const loadData = async () => {
      const [cardsRes, leadsRes, contactsRes, reviewsRes] = await Promise.all([
        supabase.from('cards').select('*').eq('company_id', companyId),
        supabase.from('leads').select('*').eq('company_id', companyId),
        supabase.from('contacts').select('*').eq('company_id', companyId),
        supabase.from('reviews').select('*').eq('company_id', companyId),
      ]);
      if (!mounted.current) return;
      setCards(cardsRes.data || []);
      setLeads(leadsRes.data || []);
      setContacts(contactsRes.data || []);
      setReviews(reviewsRes.data || []);
      setLoading(false);
    };
    loadData();

    const channel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `company_id=eq.${companyId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `company_id=eq.${companyId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${companyId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `company_id=eq.${companyId}` }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  const periodDays = period === '7' ? 7 : 30;
  const prevPeriodDays = period === '7' ? 14 : 60;

  const totalViews = cards.reduce((s, c) => s + c.views, 0);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  const leadsThisPeriod = countInPeriod(leads, periodDays);
  const leadsPrevPeriod = countInPeriod(leads, prevPeriodDays) - leadsThisPeriod;
  const contactsThisPeriod = countInPeriod(contacts, periodDays);
  const contactsPrevPeriod = countInPeriod(contacts, prevPeriodDays) - contactsThisPeriod;
  const reviewsThisPeriod = countInPeriod(reviews, periodDays);
  const reviewsPrevPeriod = countInPeriod(reviews, prevPeriodDays) - reviewsThisPeriod;

  const leadByStatus = [
    { label: 'New', count: leads.filter(l => l.status === 'new').length, color: '#3b82f6' },
    { label: 'Contacted', count: leads.filter(l => l.status === 'contacted').length, color: '#f59e0b' },
    { label: 'Converted', count: leads.filter(l => l.status === 'converted').length, color: '#16a34a' },
    { label: 'Lost', count: leads.filter(l => l.status === 'lost').length, color: '#ef4444' },
  ];
  const totalLeads = leads.length || 1;

  const leadBySource = [
    { label: 'QR Scan', count: leads.filter(l => l.source === 'qr').length, color: '#5648db' },
    { label: 'Website', count: leads.filter(l => l.source === 'website').length, color: '#3b82f6' },
    { label: 'Manual', count: leads.filter(l => l.source === 'manual').length, color: '#f59e0b' },
    { label: 'Referral', count: leads.filter(l => l.source === 'referral').length, color: '#16a34a' },
  ];
  const maxSource = Math.max(...leadBySource.map(s => s.count), 1);

  const topCards = [...cards].sort((a, b) => b.views - a.views).slice(0, 5);
  const maxCardViews = Math.max(...topCards.map(c => c.views), 1);

  const conversionRate = leads.length > 0 ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(0) : '0';

  const insights = [
    { label: 'Total Card Views', value: totalViews.toLocaleString(), icon: Eye, tone: 'violet', change: pctChange(countInPeriod(cards, periodDays), countInPeriod(cards, prevPeriodDays)) },
    { label: 'Total Leads', value: leads.length.toString(), icon: UserPlus, tone: 'blue', change: pctChange(leadsThisPeriod, leadsPrevPeriod) },
    { label: 'Total Contacts', value: contacts.length.toString(), icon: Activity, tone: 'slate', change: pctChange(contactsThisPeriod, contactsPrevPeriod) },
    { label: 'Avg Rating', value: avgRating, icon: Star, tone: 'amber', change: pctChange(reviewsThisPeriod, reviewsPrevPeriod) },
    { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, tone: 'green', change: `${leads.filter(l => l.status === 'converted').length} converted` },
    { label: 'Active Cards', value: cards.filter(c => c.status === 'active').length.toString(), icon: BarChart3, tone: 'indigo', change: `${cards.length} total` },
  ];

  // Build chart from real event data grouped by day
  const allEvents = [
    ...leads.map(l => ({ date: new Date(l.created_at) })),
    ...contacts.map(c => ({ date: new Date(c.created_at) })),
    ...reviews.map(r => ({ date: new Date(r.created_at) })),
  ];

  const numDays = period === '7' ? 7 : 30;
  const chartData: number[] = [];
  const chartLabels: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = daysAgo(i - 1);
    const count = allEvents.filter(e => e.date >= dayStart && e.date < dayEnd).length;
    chartData.push(count);
    if (period === '7') {
      chartLabels.push(dayStart.toLocaleDateString('en-IN', { weekday: 'short' }));
    } else if (i % 5 === 0) {
      chartLabels.push(dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    } else {
      chartLabels.push('');
    }
  }
  const maxChart = Math.max(...chartData, 1);

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Card Views', totalViews.toString()],
      ['Total Leads', leads.length.toString()],
      ['Total Contacts', contacts.length.toString()],
      ['Total Reviews', reviews.length.toString()],
      ['Average Rating', avgRating],
      ['Conversion Rate', `${conversionRate}%`],
      ['Active Cards', cards.filter(c => c.status === 'active').length.toString()],
      [''],
      ['Lead Breakdown by Status', ''],
      ...leadByStatus.map(s => [s.label, s.count.toString()]),
      [''],
      ['Lead Breakdown by Source', ''],
      ...leadBySource.map(s => [s.label, s.count.toString()]),
      [''],
      ['Top Performing Cards', ''],
      ...topCards.map((c, i) => [`#${i + 1} ${c.name}`, `${c.views} views`]),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="empty-state">Loading analytics...</div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="page-subtitle">Track performance and gain insights across your cards</p>
        </div>
        <div className="analytics-header-actions">
          <div className="period-toggle">
            <button className={period === '7' ? 'filter-active' : ''} onClick={() => setPeriod('7')}>7 Days</button>
            <button className={period === '30' ? 'filter-active' : ''} onClick={() => setPeriod('30')}>30 Days</button>
          </div>
          <button className="ghost-btn" onClick={exportCSV}><Download size={16} /> Export</button>
        </div>
      </div>

      <div className="metrics-grid">
        {insights.map(({ label, value, icon: Icon, tone, change }) => (
          <article className="metric-card" key={label}>
            <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
            <div><p>{label}</p><strong>{value}</strong><span><TrendingUp size={13} /> {change}</span></div>
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <section className="panel analytics-chart-panel">
          <div className="panel-heading"><h2>Activity Over Time</h2></div>
          <div className="bar-chart">
            {chartData.map((val, i) => (
              <div className="bar-col" key={i}>
                <div className="bar-fill" style={{ height: `${(val / maxChart) * 100}%` }}>
                  <span className="bar-tooltip">{val}</span>
                </div>
                <span className="bar-label">{chartLabels[i]}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>Leads, contacts, and reviews per day from real data</p>
        </section>

        <section className="panel analytics-donut-panel">
          <div className="panel-heading"><h2>Leads by Status</h2></div>
          <div className="donut-chart">
            <svg viewBox="0 0 100 100" className="donut-svg">
              {(() => {
                let offset = 0;
                return leadByStatus.map((s, i) => {
                  const pct = (s.count / totalLeads) * 100;
                  const dash = pct * 2.51;
                  const seg = (
                    <circle
                      key={i}
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke={s.color}
                      strokeWidth="14"
                      strokeDasharray={`${dash} ${251.2 - dash}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 50 50)"
                    />
                  );
                  offset += dash;
                  return seg;
                });
              })()}
            </svg>
            <div className="donut-center">
              <strong>{leads.length}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="donut-legend">
            {leadByStatus.map((s, i) => (
              <div className="legend-item" key={i}>
                <span className="legend-dot" style={{ background: s.color }} />
                <span className="legend-label">{s.label}</span>
                <span className="legend-count">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel analytics-source-panel">
          <div className="panel-heading"><h2>Leads by Source</h2></div>
          <div className="h-bar-list">
            {leadBySource.map((s, i) => (
              <div className="h-bar-row" key={i}>
                <span className="h-bar-label">{s.label}</span>
                <div className="h-bar-track"><div className="h-bar-fill" style={{ width: `${(s.count / maxSource) * 100}%`, background: s.color }} /></div>
                <span className="h-bar-count">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel analytics-topcards-panel">
          <div className="panel-heading"><h2>Top Performing Cards</h2></div>
          {topCards.length === 0 ? (
            <div className="muted" style={{ padding: '20px 0', textAlign: 'center', fontSize: 13 }}>No cards yet</div>
          ) : (
            <div className="topcards-list">
              {topCards.map((card, i) => (
                <div className="topcard-row" key={card.id}>
                  <span className="topcard-rank">#{i + 1}</span>
                  <div className="topcard-info">
                    <strong>{card.name}</strong>
                    <span>@{card.handle}</span>
                  </div>
                  <div className="topcard-bar"><div style={{ width: `${(card.views / maxCardViews) * 100}%` }} /></div>
                  <span className="topcard-views">{card.views}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
