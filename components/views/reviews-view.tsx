'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, Filter, Link2, Loader2, MessageCircle, MoreVertical, Plus, Search, Send, Settings2, Share2, Sparkles, Star, Tag, Trash2, X, Zap, Megaphone, Phone, Mail, ExternalLink, ArrowRight } from 'lucide-react';
import { supabase, type Review, type BusinessProfile, type ReviewRequest, type ReviewTemplate, type ReviewCampaign } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type ReviewInput = {
  reviewer_name: string;
  rating: number;
  comment: string;
  source: Review['source'];
  tags: string[];
};

const emptyReview: ReviewInput = { reviewer_name: '', rating: 5, comment: '', source: 'direct', tags: [] };

const sourceLabels: Record<string, string> = {
  google: 'Google', facebook: 'Facebook', justdial: 'Justdial', whatsapp: 'WhatsApp', direct: 'Direct', campaign: 'Campaign', other: 'Other',
};

const statusLabels: Record<string, { label: string; cls: string }> = {
  public: { label: 'Public', cls: 'rstatus-public' },
  need_attention: { label: 'Need Attention', cls: 'rstatus-attention' },
  hidden: { label: 'Hidden', cls: 'rstatus-hidden' },
  resolved: { label: 'Resolved', cls: 'rstatus-resolved' },
};

const followUpLabels: Record<string, { label: string; cls: string }> = {
  none: { label: 'No Action', cls: 'fu-none' },
  pending: { label: 'Pending', cls: 'fu-pending' },
  contacted: { label: 'Contacted', cls: 'fu-contacted' },
  resolved: { label: 'Resolved', cls: 'fu-resolved' },
};

const commonTags = ['Quality Service', 'Professional Team', 'Quick Response', 'Good Support', 'Easy to Use', 'Great Platform', 'Slow Response', 'Poor Support', 'Overpriced'];

type Tab = 'reviews' | 'campaigns' | 'requests' | 'templates' | 'routing' | 'customize';

type CampaignForm = {
  name: string;
  description: string;
  question: string;
  google_review_url: string;
  is_active: boolean;
};

const emptyCampaignForm: CampaignForm = { name: '', description: '', question: '', google_review_url: '', is_active: true };

type CustomizeForm = {
  review_heading: string;
  review_subheading: string;
  review_background_color: string;
  review_thank_you_message: string;
  google_business: string;
};

export function ReviewsView() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const [tab, setTab] = useState<Tab>('reviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<ReviewCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReviewInput>(emptyReview);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [generatingReply, setGeneratingReply] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ customer_name: '', customer_phone: '', customer_email: '', channel: 'whatsapp' as ReviewRequest['channel'] });
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', channel: 'whatsapp' as ReviewTemplate['channel'], subject: '', body: '' });
  const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
  const [routingRules, setRoutingRules] = useState({ id: '', positive: 'google', neutral: 'feedback', negative: 'feedback' });
  const [savingRouting, setSavingRouting] = useState(false);
  const [reviewLinkCopied, setReviewLinkCopied] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(emptyCampaignForm);
  const [editingCampaign, setEditingCampaign] = useState<ReviewCampaign | null>(null);
  const [followUpModal, setFollowUpModal] = useState<Review | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<'none' | 'pending' | 'contacted' | 'resolved'>('none');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [customizeForm, setCustomizeForm] = useState<CustomizeForm>({ review_heading: '', review_subheading: '', review_background_color: '', review_thank_you_message: '', google_business: '' });
  const [savingCustomize, setSavingCustomize] = useState(false);

  const reviewSlug = profile?.review_slug;
  const reviewLink = reviewSlug ? `${window.location.origin}/review/${reviewSlug}` : `${window.location.origin}/review`;

  const fetchAll = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [r, bp, rq, rt, rr, rc] = await Promise.all([
      supabase.from('reviews').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('business_profile').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('review_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('review_templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('review_routing_rules').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('review_campaigns').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    ]);
    setReviews(r.data || []);
    setProfile(bp.data as BusinessProfile | null);
    setRequests(rq.data || []);
    setTemplates(rt.data || []);
    if (rr.data) setRoutingRules(rr.data as typeof routingRules);
    setCampaigns(rc.data || []);
    if (bp.data) {
      const p = bp.data as BusinessProfile;
      setCustomizeForm({
        review_heading: p.review_heading || '',
        review_subheading: p.review_subheading || '',
        review_background_color: p.review_background_color || '',
        review_thank_you_message: p.review_thank_you_message || '',
        google_business: p.google_business || '',
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [companyId]);

  const filtered = reviews.filter(r => {
    const matchSearch = r.reviewer_name.toLowerCase().includes(search.toLowerCase()) || (r.comment || '').toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === 'all' || r.source === sourceFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchFollowUp = followUpFilter === 'all' || r.follow_up_status === followUpFilter;
    return matchSearch && matchSource && matchStatus && matchFollowUp;
  });

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating >= 4).length;
  const needAttention = reviews.filter(r => r.status === 'need_attention').length;
  const googleRedirects = reviews.filter(r => r.routed_to === 'google' && r.google_redirect_clicked).length;
  const googleRedirectRate = reviews.filter(r => r.routed_to === 'google').length > 0
    ? Math.round((googleRedirects / reviews.filter(r => r.routed_to === 'google').length) * 100)
    : 0;
  const pendingFollowUps = reviews.filter(r => r.follow_up_status === 'pending').length;
  const responseRate = totalReviews > 0 ? Math.round((reviews.filter(r => r.ai_reply || r.business_reply).length / totalReviews) * 100) : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(r => r.rating === star).length }));
  const maxCount = Math.max(...ratingCounts.map(r => r.count), 1);
  const sourceCounts = ['google', 'facebook', 'justdial', 'whatsapp', 'campaign', 'direct', 'other'].map(src => ({ src, count: reviews.filter(r => r.source === src).length }));
  const totalForSource = sourceCounts.reduce((s, c) => s + c.count, 0) || 1;

  const save = async () => {
    if (!form.reviewer_name) { setToast('Reviewer name is required'); window.setTimeout(() => setToast(''), 2500); return; }
    if (!companyId) { setToast('Unable to save review. Please refresh the page.'); window.setTimeout(() => setToast(''), 3500); return; }
    const { error } = await supabase.from('reviews').insert({
      reviewer_name: form.reviewer_name, rating: form.rating, comment: form.comment || null,
      source: form.source, tags: form.tags, status: form.rating >= 4 ? 'public' : 'need_attention',
      company_id: companyId, follow_up_status: form.rating >= 4 ? 'none' : 'pending',
    });
    if (error) { setToast(error.message || 'Failed to add review.'); window.setTimeout(() => setToast(''), 3500); return; }
    setShowForm(false); setForm(emptyReview); fetchAll();
    setToast('Review added successfully'); window.setTimeout(() => setToast(''), 2500);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    setMenuOpen(null); fetchAll();
    setToast(error ? 'Failed to delete' : 'Review deleted');
    window.setTimeout(() => setToast(''), 2500);
  };

  const updateStatus = async (id: string, status: Review['status']) => {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
    if (error) { setToast('Failed to update status'); window.setTimeout(() => setToast(''), 2500); return; }
    setReviews(reviews.map(r => r.id === id ? { ...r, status } : r));
    setMenuOpen(null);
    setToast(`Review marked as ${statusLabels[status].label}`);
    window.setTimeout(() => setToast(''), 2500);
  };

  const openFollowUp = (review: Review) => {
    setFollowUpModal(review);
    setFollowUpNotes(review.follow_up_notes || '');
    setFollowUpStatus(review.follow_up_status);
    setMenuOpen(null);
  };

  const saveFollowUp = async () => {
    if (!followUpModal) return;
    setSavingFollowUp(true);
    const { error } = await supabase.from('reviews').update({
      follow_up_status: followUpStatus,
      follow_up_notes: followUpNotes || null,
      follow_up_at: followUpStatus !== 'none' ? new Date().toISOString() : null,
    }).eq('id', followUpModal.id);
    setSavingFollowUp(false);
    if (error) { setToast('Failed to save follow-up'); window.setTimeout(() => setToast(''), 2500); return; }
    setReviews(reviews.map(r => r.id === followUpModal.id ? { ...r, follow_up_status: followUpStatus, follow_up_notes: followUpNotes || null } : r));
    setFollowUpModal(null); setFollowUpNotes(''); setFollowUpStatus('none');
    setToast('Follow-up updated'); window.setTimeout(() => setToast(''), 2500);
  };

  const generateAiReply = async (review: Review) => {
    setGeneratingReply(review.id);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-review-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ review_id: review.id, reviewer_name: review.reviewer_name, rating: review.rating, comment: review.comment, business_name: profile?.business_name }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'AI reply generation failed'); }
      const data = await res.json();
      setReviews(reviews.map(r => r.id === review.id ? { ...r, ai_reply: data.reply, ai_reply_at: new Date().toISOString() } : r));
      setToast('AI reply generated!'); window.setTimeout(() => setToast(''), 2500);
    } catch (err: any) {
      setToast(err.message || 'AI reply failed.'); window.setTimeout(() => setToast(''), 3500);
    } finally { setGeneratingReply(null); }
  };

  const saveReplyEdit = async (reviewId: string) => {
    const { error } = await supabase.from('reviews').update({ ai_reply: replyDraft, ai_reply_at: new Date().toISOString() }).eq('id', reviewId);
    if (error) { setToast('Failed to save reply'); window.setTimeout(() => setToast(''), 2500); return; }
    setReviews(reviews.map(r => r.id === reviewId ? { ...r, ai_reply: replyDraft } : r));
    setEditingReply(null); setReplyDraft('');
    setToast('Reply updated'); window.setTimeout(() => setToast(''), 2500);
  };

  const copyReply = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast('Reply copied to clipboard'); window.setTimeout(() => setToast(''), 2000);
  };

  const sendRequest = async () => {
    if (!requestForm.customer_name) { setToast('Customer name is required'); window.setTimeout(() => setToast(''), 2500); return; }
    if (!companyId) { setToast('Unable to send request. Please refresh.'); window.setTimeout(() => setToast(''), 3500); return; }
    const { error } = await supabase.from('review_requests').insert({
      customer_name: requestForm.customer_name, customer_phone: requestForm.customer_phone || null,
      customer_email: requestForm.customer_email || null, channel: requestForm.channel, status: 'sent', company_id: companyId,
    });
    if (error) { setToast('Failed to send request'); window.setTimeout(() => setToast(''), 2500); return; }
    setShowRequestForm(false);
    setRequestForm({ customer_name: '', customer_phone: '', customer_email: '', channel: 'whatsapp' });
    const { data } = await supabase.from('review_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setRequests(data || []);
    setToast('Review request sent!'); window.setTimeout(() => setToast(''), 2500);
  };

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) { setToast('Template name and body are required'); window.setTimeout(() => setToast(''), 2500); return; }
    if (!companyId) { setToast('Unable to save template. Please refresh.'); window.setTimeout(() => setToast(''), 3500); return; }
    if (editingTemplate) {
      const { error } = await supabase.from('review_templates').update({ ...templateForm, updated_at: new Date().toISOString() }).eq('id', editingTemplate.id);
      if (error) { setToast('Failed to update template'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Template updated');
    } else {
      const { error } = await supabase.from('review_templates').insert({ ...templateForm, company_id: companyId });
      if (error) { setToast('Failed to create template'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Template created');
    }
    setShowTemplateForm(false); setEditingTemplate(null);
    setTemplateForm({ name: '', channel: 'whatsapp', subject: '', body: '' });
    const { data } = await supabase.from('review_templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setTemplates(data || []);
    window.setTimeout(() => setToast(''), 2500);
  };

  const openTemplateEdit = (t: ReviewTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, channel: t.channel, subject: t.subject || '', body: t.body });
    setShowTemplateForm(true);
  };

  const removeTemplate = async (id: string) => {
    const { error } = await supabase.from('review_templates').delete().eq('id', id);
    if (error) { setToast('Failed to delete template'); window.setTimeout(() => setToast(''), 2500); return; }
    setTemplates(templates.filter(t => t.id !== id));
    setToast('Template deleted'); window.setTimeout(() => setToast(''), 2500);
  };

  const saveCampaign = async () => {
    if (!campaignForm.name) { setToast('Campaign name is required'); window.setTimeout(() => setToast(''), 2500); return; }
    if (!companyId) { setToast('Unable to save campaign. Please refresh.'); window.setTimeout(() => setToast(''), 3500); return; }
    const slug = campaignForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
    if (editingCampaign) {
      const { error } = await supabase.from('review_campaigns').update({
        name: campaignForm.name, description: campaignForm.description || null,
        question: campaignForm.question || null, google_review_url: campaignForm.google_review_url || null,
        is_active: campaignForm.is_active, updated_at: new Date().toISOString(),
      }).eq('id', editingCampaign.id);
      if (error) { setToast('Failed to update campaign'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Campaign updated');
    } else {
      const { error } = await supabase.from('review_campaigns').insert({
        name: campaignForm.name, description: campaignForm.description || null,
        question: campaignForm.question || null, google_review_url: campaignForm.google_review_url || null,
        is_active: campaignForm.is_active, slug, company_id: companyId,
      });
      if (error) { setToast('Failed to create campaign'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Campaign created');
    }
    setShowCampaignForm(false); setEditingCampaign(null); setCampaignForm(emptyCampaignForm);
    const { data } = await supabase.from('review_campaigns').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setCampaigns(data || []);
    window.setTimeout(() => setToast(''), 2500);
  };

  const removeCampaign = async (id: string) => {
    const { error } = await supabase.from('review_campaigns').delete().eq('id', id);
    if (error) { setToast('Failed to delete campaign'); window.setTimeout(() => setToast(''), 2500); return; }
    setCampaigns(campaigns.filter(c => c.id !== id));
    setToast('Campaign deleted'); window.setTimeout(() => setToast(''), 2500);
  };

  const toggleCampaignActive = async (campaign: ReviewCampaign) => {
    const { error } = await supabase.from('review_campaigns').update({ is_active: !campaign.is_active, updated_at: new Date().toISOString() }).eq('id', campaign.id);
    if (error) { setToast('Failed to update campaign'); window.setTimeout(() => setToast(''), 2500); return; }
    setCampaigns(campaigns.map(c => c.id === campaign.id ? { ...c, is_active: !c.is_active } : c));
    setToast(campaign.is_active ? 'Campaign paused' : 'Campaign activated');
    window.setTimeout(() => setToast(''), 2500);
  };

  const saveCustomize = async () => {
    if (!profile) { setToast('No business profile found'); window.setTimeout(() => setToast(''), 2500); return; }
    setSavingCustomize(true);
    const { error } = await supabase.from('business_profile').update({
      review_heading: customizeForm.review_heading || null,
      review_subheading: customizeForm.review_subheading || null,
      review_background_color: customizeForm.review_background_color || null,
      review_thank_you_message: customizeForm.review_thank_you_message || null,
      google_business: customizeForm.google_business || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id);
    setSavingCustomize(false);
    if (error) { setToast('Failed to save settings'); window.setTimeout(() => setToast(''), 2500); return; }
    setToast('Review page settings saved'); window.setTimeout(() => setToast(''), 2500);
  };

  const renderStars = (rating: number, size = 16) => {
    return [1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={size} className={i <= rating ? 'star-filled' : 'star-empty'} fill={i <= rating ? 'currentColor' : 'none'} />
    ));
  };

  const tabs: { key: Tab; label: string; icon: typeof Star }[] = [
    { key: 'reviews', label: 'Reviews', icon: Star },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { key: 'requests', label: 'Requests', icon: Send },
    { key: 'templates', label: 'Templates', icon: MessageCircle },
    { key: 'routing', label: 'Routing', icon: Settings2 },
    { key: 'customize', label: 'Customize', icon: Eye },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Smart Review System</h2>
          <p className="page-subtitle">Collect feedback, route happy customers to Google, capture unhappy feedback internally</p>
        </div>
        <div className="review-header-actions">
          {tab === 'reviews' && (
            <>
              <button className="ghost-btn" onClick={() => { setReviewLinkCopied(true); navigator.clipboard.writeText(reviewLink); window.setTimeout(() => setReviewLinkCopied(false), 2000); }}>
                {reviewLinkCopied ? <><Check size={15} /> Copied!</> : <><Link2 size={15} /> Copy Review Link</>}
              </button>
              <button className="primary-btn" onClick={() => { setForm(emptyReview); setShowForm(true); }}><Plus size={17} /> Add Review</button>
            </>
          )}
          {tab === 'campaigns' && <button className="primary-btn" onClick={() => { setEditingCampaign(null); setCampaignForm(emptyCampaignForm); setShowCampaignForm(true); }}><Plus size={17} /> New Campaign</button>}
          {tab === 'requests' && <button className="primary-btn" onClick={() => setShowRequestForm(true)}><Plus size={17} /> Send Request</button>}
          {tab === 'templates' && <button className="primary-btn" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', channel: 'whatsapp', subject: '', body: '' }); setShowTemplateForm(true); }}><Plus size={17} /> New Template</button>}
        </div>
      </div>

      <div className="review-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`review-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'reviews' && (
        <>
          <div className="rep-stats-row">
            <div className="rep-stat-card"><div className="rep-stat-icon rating"><Star size={18} fill="currentColor" /></div><div><strong>{avgRating}</strong><span>Avg Rating</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon total"><Eye size={18} /></div><div><strong>{totalReviews}</strong><span>Total Reviews</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon positive"><Check size={18} /></div><div><strong>{positiveReviews} ({totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 100) : 0}%)</strong><span>Positive</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon attention"><Zap size={18} /></div><div><strong>{needAttention}</strong><span>Need Attention</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon response"><ExternalLink size={18} /></div><div><strong>{googleRedirects} ({googleRedirectRate}%)</strong><span>Google Clicks</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon total"><MessageCircle size={18} /></div><div><strong>{pendingFollowUps}</strong><span>Pending Follow-ups</span></div></div>
          </div>

          <div className="rep-breakdown-row">
            <div className="rep-breakdown-card">
              <h4>Rating Breakdown</h4>
              {ratingCounts.map(({ star, count }) => (
                <div className="rating-bar-row" key={star}>
                  <span className="rating-label">{star} <Star size={11} className="star-filled" fill="currentColor" /></span>
                  <div className="rating-bar"><div className="rating-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} /></div>
                  <span className="rating-count">{count}</span>
                </div>
              ))}
            </div>
            <div className="rep-breakdown-card">
              <h4>Reviews by Source</h4>
              {sourceCounts.map(({ src, count }) => (
                <div className="rating-bar-row" key={src}>
                  <span className="rating-label">{sourceLabels[src]}</span>
                  <div className="rating-bar"><div className="rating-bar-fill" style={{ width: `${(count / totalForSource) * 100}%`, background: '#5648db' }} /></div>
                  <span className="rating-count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search reviews by name or content..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="filter-group">
              <select className="filter-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                <option value="all">All Sources</option>
                <option value="google">Google</option>
                <option value="facebook">Facebook</option>
                <option value="justdial">Justdial</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="campaign">Campaign</option>
                <option value="direct">Direct</option>
                <option value="other">Other</option>
              </select>
              <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="public">Public</option>
                <option value="need_attention">Need Attention</option>
                <option value="hidden">Hidden</option>
                <option value="resolved">Resolved</option>
              </select>
              <select className="filter-select" value={followUpFilter} onChange={e => setFollowUpFilter(e.target.value)}>
                <option value="all">All Follow-ups</option>
                <option value="none">No Action</option>
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="resolved">Follow-up Resolved</option>
              </select>
            </div>
          </div>

          {(loading || companyLoading) ? (
            <div className="empty-state">Loading reviews...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Star size={48} />
              <h3>No reviews found</h3>
              <p>{search || sourceFilter !== 'all' || statusFilter !== 'all' || followUpFilter !== 'all' ? 'Try different filters.' : 'Share your review link or send a review request to get started.'}</p>
            </div>
          ) : (
            <div className="reviews-grid">
              {filtered.map(review => (
                <div className={`review-card ${review.status === 'need_attention' ? 'review-card-attention' : ''}`} key={review.id}>
                  <div className="review-card-top">
                    <div className="review-avatar">{review.reviewer_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                    <div className="review-info">
                      <strong>{review.reviewer_name}</strong>
                      <div className="review-source-row">
                        <div className="stars-row">{renderStars(review.rating)}</div>
                        <span className="review-source-tag">{sourceLabels[review.source]}</span>
                      </div>
                    </div>
                    <div className="card-item-menu">
                      <button onClick={() => setMenuOpen(menuOpen === review.id ? null : review.id)} aria-label="Review menu"><MoreVertical size={18} /></button>
                      {menuOpen === review.id && (
                        <div className="menu-dropdown">
                          {review.rating < 4 && <button onClick={() => openFollowUp(review)}><MessageCircle size={14} /> Follow Up</button>}
                          {review.status !== 'resolved' && <button onClick={() => updateStatus(review.id, 'resolved')}><Check size={14} /> Mark Resolved</button>}
                          {review.status !== 'hidden' && <button onClick={() => updateStatus(review.id, 'hidden')}><Eye size={14} /> Hide</button>}
                          {review.status !== 'public' && <button onClick={() => updateStatus(review.id, 'public')}><Eye size={14} /> Make Public</button>}
                          <button onClick={() => remove(review.id)} className="danger"><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {review.comment && <p className="review-comment">{review.comment}</p>}
                  {review.tags.length > 0 && (
                    <div className="review-tags">
                      {review.tags.map(tag => <span key={tag} className={`review-tag ${tag.includes('Slow') || tag.includes('Poor') || tag.includes('Overpriced') ? 'negative' : 'positive'}`}><Tag size={9} /> {tag}</span>)}
                    </div>
                  )}
                  {(review.customer_phone || review.customer_email) && (
                    <div className="review-contact-info">
                      {review.customer_phone && <span><Phone size={11} /> {review.customer_phone}</span>}
                      {review.customer_email && <span><Mail size={11} /> {review.customer_email}</span>}
                    </div>
                  )}
                  <div className="review-meta-row">
                    <span className="review-date">{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className={`review-status-badge ${statusLabels[review.status].cls}`}>{statusLabels[review.status].label}</span>
                    {review.follow_up_status !== 'none' && (
                      <span className={`review-status-badge ${followUpLabels[review.follow_up_status].cls}`}>{followUpLabels[review.follow_up_status].label}</span>
                    )}
                    {review.routed_to === 'google' && (
                      <span className={`review-status-badge ${review.google_redirect_clicked ? 'rstatus-resolved' : 'rstatus-attention'}`}>
                        <ExternalLink size={10} /> {review.google_redirect_clicked ? 'Clicked Google' : 'Google Pending'}
                      </span>
                    )}
                  </div>

                  {review.ai_reply && editingReply !== review.id ? (
                    <div className="ai-reply-box">
                      <div className="ai-reply-header">
                        <Sparkles size={13} /> <span>AI Reply</span>
                        <button className="ai-reply-action" onClick={() => copyReply(review.ai_reply!)}><Copy size={12} /></button>
                        <button className="ai-reply-action" onClick={() => { setEditingReply(review.id); setReplyDraft(review.ai_reply!); }}>Edit</button>
                      </div>
                      <p>{review.ai_reply}</p>
                    </div>
                  ) : editingReply === review.id ? (
                    <div className="ai-reply-box">
                      <div className="ai-reply-header"><Sparkles size={13} /> <span>Edit Reply</span></div>
                      <textarea className="ai-reply-editor" value={replyDraft} onChange={e => setReplyDraft(e.target.value)} rows={3} />
                      <div className="ai-reply-actions">
                        <button className="ghost-btn sm" onClick={() => { setEditingReply(null); setReplyDraft(''); }}>Cancel</button>
                        <button className="primary-btn sm" onClick={() => saveReplyEdit(review.id)}>Save Reply</button>
                      </div>
                    </div>
                  ) : (
                    <button className="ai-reply-btn" onClick={() => generateAiReply(review)} disabled={generatingReply === review.id}>
                      {generatingReply === review.id ? (
                        <><Loader2 size={14} className="spin" /> AI is writing a reply...</>
                      ) : (
                        <><Sparkles size={14} /> Generate AI Reply</>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'campaigns' && (
        <>
          {(loading || companyLoading) ? (
            <div className="empty-state">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={48} />
              <h3>No campaigns yet</h3>
              <p>Create themed review campaigns like &quot;Post-Dinner Feedback&quot; or &quot;Guest Checkout&quot; to collect targeted feedback.</p>
              <button className="primary-btn" onClick={() => { setEditingCampaign(null); setCampaignForm(emptyCampaignForm); setShowCampaignForm(true); }}><Plus size={17} /> New Campaign</button>
            </div>
          ) : (
            <div className="campaigns-grid">
              {campaigns.map(c => {
                const campaignReviews = reviews.filter(r => r.campaign_id === c.id);
                const campaignPositive = campaignReviews.filter(r => r.rating >= 4).length;
                const campaignGoogleClicks = campaignReviews.filter(r => r.google_redirect_clicked).length;
                const campaignLink = reviewSlug ? `${reviewLink}?campaign=${c.slug}` : reviewLink;
                return (
                  <div className={`campaign-card ${!c.is_active ? 'campaign-card-inactive' : ''}`} key={c.id}>
                    <div className="campaign-card-top">
                      <div>
                        <strong>{c.name}</strong>
                        {c.is_active ? <span className="campaign-status active">Active</span> : <span className="campaign-status paused">Paused</span>}
                      </div>
                      <div className="card-item-menu">
                        <button onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}><MoreVertical size={18} /></button>
                        {menuOpen === c.id && (
                          <div className="menu-dropdown">
                            <button onClick={() => { setEditingCampaign(c); setCampaignForm({ name: c.name, description: c.description || '', question: c.question || '', google_review_url: c.google_review_url || '', is_active: c.is_active }); setShowCampaignForm(true); setMenuOpen(null); }}><Settings2 size={14} /> Edit</button>
                            <button onClick={() => { navigator.clipboard.writeText(campaignLink); setToast('Campaign link copied'); window.setTimeout(() => setToast(''), 2000); setMenuOpen(null); }}><Link2 size={14} /> Copy Link</button>
                            <button onClick={() => toggleCampaignActive(c)}>{c.is_active ? <><Zap size={14} /> Pause</> : <><Check size={14} /> Activate</>}</button>
                            <button onClick={() => removeCampaign(c.id)} className="danger"><Trash2 size={14} /> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {c.description && <p className="campaign-desc">{c.description}</p>}
                    {c.question && <div className="campaign-question"><MessageCircle size={13} /> {c.question}</div>}
                    <div className="campaign-stats">
                      <div className="campaign-stat"><strong>{campaignReviews.length}</strong><span>Reviews</span></div>
                      <div className="campaign-stat"><strong>{campaignPositive}</strong><span>Positive</span></div>
                      <div className="campaign-stat"><strong>{campaignGoogleClicks}</strong><span>Google Clicks</span></div>
                    </div>
                    <div className="campaign-link-box">
                      <code>{campaignLink}</code>
                      <button className="ghost-btn sm" onClick={() => { navigator.clipboard.writeText(campaignLink); setToast('Link copied'); window.setTimeout(() => setToast(''), 2000); }}><Copy size={12} /> Copy</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <>
          <div className="rep-stats-row">
            <div className="rep-stat-card"><div className="rep-stat-icon total"><Send size={18} /></div><div><strong>{requests.length}</strong><span>Total Sent</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon positive"><Check size={18} /></div><div><strong>{requests.filter(r => r.status === 'completed').length}</strong><span>Completed</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon attention"><Zap size={18} /></div><div><strong>{requests.filter(r => r.status === 'pending' || r.status === 'sent').length}</strong><span>Pending</span></div></div>
            <div className="rep-stat-card"><div className="rep-stat-icon response"><Eye size={18} /></div><div><strong>{requests.length > 0 ? Math.round((requests.filter(r => r.status === 'completed').length / requests.length) * 100) : 0}%</strong><span>Conversion Rate</span></div></div>
          </div>

          {loading ? (
            <div className="empty-state">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <Send size={48} />
              <h3>No review requests yet</h3>
              <p>Send review requests to your customers via WhatsApp, SMS, or email.</p>
              <button className="primary-btn" onClick={() => setShowRequestForm(true)}><Plus size={17} /> Send Request</button>
            </div>
          ) : (
            <div className="data-table">
              <table>
                <thead>
                  <tr><th>Customer</th><th>Channel</th><th>Status</th><th>Rating</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {requests.map(rq => (
                    <tr key={rq.id}>
                      <td><strong>{rq.customer_name}</strong><div className="muted" style={{ fontSize: 11 }}>{rq.customer_phone || rq.customer_email || '—'}</div></td>
                      <td><span className="review-source-tag">{rq.channel}</span></td>
                      <td><span className={`review-status-badge ${rq.status === 'completed' ? 'rstatus-resolved' : rq.status === 'pending' || rq.status === 'sent' ? 'rstatus-attention' : 'rstatus-hidden'}`}>{rq.status}</span></td>
                      <td>{rq.rating ? <span className="stars-row">{renderStars(rq.rating, 12)}</span> : '—'}</td>
                      <td className="muted">{new Date(rq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td><button className="ghost-btn sm"><Share2 size={12} /> Resend</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'templates' && (
        <>
          {loading ? (
            <div className="empty-state">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={48} />
              <h3>No templates yet</h3>
              <p>Create reusable message templates for review requests.</p>
              <button className="primary-btn" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', channel: 'whatsapp', subject: '', body: '' }); setShowTemplateForm(true); }}><Plus size={17} /> New Template</button>
            </div>
          ) : (
            <div className="templates-grid">
              {templates.map(t => (
                <div className="template-card" key={t.id}>
                  <div className="template-card-top">
                    <strong>{t.name}</strong>
                    <span className="review-source-tag">{t.channel}</span>
                  </div>
                  {t.subject && <div className="template-subject">{t.subject}</div>}
                  <p className="template-body">{t.body}</p>
                  <div className="template-actions">
                    <button className="ghost-btn sm" onClick={() => openTemplateEdit(t)}><MessageCircle size={12} /> Edit</button>
                    <button className="ghost-btn sm danger" onClick={() => removeTemplate(t.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'routing' && (
        <div className="setup-section" style={{ maxWidth: 600 }}>
          <div className="setup-section-title"><Settings2 size={20} /> Review Routing Rules</div>
          <p className="setup-hint">Configure where customers are directed based on their rating. Positive ratings go to public review platforms; negative ratings are captured as private feedback so you can resolve issues.</p>

          <div className="routing-rule">
            <div className="routing-rule-label"><Star size={16} className="star-filled" fill="currentColor" /> 4-5 Stars (Positive)</div>
            <select className="filter-select" value={routingRules.positive} onChange={e => setRoutingRules({ ...routingRules, positive: e.target.value })}>
              <option value="google">Send to Google Reviews</option>
              <option value="facebook">Send to Facebook Reviews</option>
              <option value="justdial">Send to Justdial</option>
              <option value="feedback">Capture as Private Feedback</option>
            </select>
          </div>
          <div className="routing-rule">
            <div className="routing-rule-label"><Star size={16} className="star-filled" fill="currentColor" /> 3 Stars (Neutral)</div>
            <select className="filter-select" value={routingRules.neutral} onChange={e => setRoutingRules({ ...routingRules, neutral: e.target.value })}>
              <option value="google">Send to Google Reviews</option>
              <option value="feedback">Capture as Private Feedback</option>
            </select>
          </div>
          <div className="routing-rule">
            <div className="routing-rule-label"><Star size={16} className="star-empty" fill="none" /> 1-2 Stars (Negative)</div>
            <select className="filter-select" value={routingRules.negative} onChange={e => setRoutingRules({ ...routingRules, negative: e.target.value })}>
              <option value="feedback">Capture as Private Feedback</option>
              <option value="google">Send to Google Reviews</option>
            </select>
          </div>
          <button className="primary-btn" onClick={async () => {
            setSavingRouting(true);
            const payload = { positive: routingRules.positive, neutral: routingRules.neutral, negative: routingRules.negative, updated_at: new Date().toISOString() };
            if (routingRules.id) {
              await supabase.from('review_routing_rules').update(payload).eq('id', routingRules.id);
            } else {
              const { data } = await supabase.from('review_routing_rules').insert({ positive: routingRules.positive, neutral: routingRules.neutral, negative: routingRules.negative, company_id: companyId }).select('*').maybeSingle();
              if (data) setRoutingRules(data as typeof routingRules);
            }
            setSavingRouting(false);
            setToast('Routing rules saved'); window.setTimeout(() => setToast(''), 2500);
          }} disabled={savingRouting}>
            {savingRouting ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Check size={16} /> Save Routing Rules</>}
          </button>
        </div>
      )}

      {tab === 'customize' && (
        <div className="setup-section" style={{ maxWidth: 640 }}>
          <div className="setup-section-title"><Eye size={20} /> Review Page Customization</div>
          <p className="setup-hint">Customize what your customers see when they open your review link. Make it feel like your brand.</p>

          <div className="form-field">
            <label>Google Review URL</label>
            <input value={customizeForm.google_business} onChange={e => setCustomizeForm({ ...customizeForm, google_business: e.target.value })} placeholder="https://g.page/yourbusiness/review" />
            <span className="form-hint">Where positive reviewers are sent. Paste your Google Business review link here.</span>
          </div>

          <div className="form-field">
            <label>Review Page Heading</label>
            <input value={customizeForm.review_heading} onChange={e => setCustomizeForm({ ...customizeForm, review_heading: e.target.value })} placeholder="How was your experience?" />
          </div>

          <div className="form-field">
            <label>Review Page Subheading</label>
            <input value={customizeForm.review_subheading} onChange={e => setCustomizeForm({ ...customizeForm, review_subheading: e.target.value })} placeholder="Your feedback helps us serve you better" />
          </div>

          <div className="form-field">
            <label>Thank You Message</label>
            <textarea value={customizeForm.review_thank_you_message} onChange={e => setCustomizeForm({ ...customizeForm, review_thank_you_message: e.target.value })} placeholder="Thank you for taking the time to share your experience!" rows={3} />
            <span className="form-hint">Shown after the customer submits their rating or feedback.</span>
          </div>

          <div className="form-field">
            <label>Background Color (optional)</label>
            <div className="color-input-row">
              <input type="color" value={customizeForm.review_background_color || '#f0f4ff'} onChange={e => setCustomizeForm({ ...customizeForm, review_background_color: e.target.value })} style={{ width: 48, height: 40, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }} />
              <input value={customizeForm.review_background_color} onChange={e => setCustomizeForm({ ...customizeForm, review_background_color: e.target.value })} placeholder="#f0f4ff" />
            </div>
          </div>

          <button className="primary-btn" onClick={saveCustomize} disabled={savingCustomize}>
            {savingCustomize ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Check size={16} /> Save Settings</>}
          </button>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Review</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Reviewer Name *</label>
                <input value={form.reviewer_name} onChange={e => setForm({ ...form, reviewer_name: e.target.value })} placeholder="e.g. Priya Sharma" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Rating</label>
                  <div className="rating-input">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} type="button" onClick={() => setForm({ ...form, rating: i })} aria-label={`${i} stars`}>
                        <Star size={28} className={i <= form.rating ? 'star-filled' : 'star-empty'} fill={i <= form.rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-field">
                  <label>Source</label>
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as Review['source'] })}>
                    <option value="direct">Direct</option>
                    <option value="google">Google</option>
                    <option value="facebook">Facebook</option>
                    <option value="justdial">Justdial</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="campaign">Campaign</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Comment</label>
                <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder="What did they say?" rows={4} />
              </div>
              <div className="form-field">
                <label>Tags</label>
                <div className="tag-picker">
                  {commonTags.map(tag => (
                    <button key={tag} className={`tag-chip ${form.tags.includes(tag) ? 'selected' : ''}`} onClick={() => {
                      setForm(form.tags.includes(tag)
                        ? { ...form, tags: form.tags.filter(t => t !== tag) }
                        : { ...form, tags: [...form.tags, tag] });
                    }}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={save}>Add Review</button>
            </div>
          </div>
        </div>
      )}

      {showCampaignForm && (
        <div className="modal-overlay" onClick={() => setShowCampaignForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</h3>
              <button onClick={() => setShowCampaignForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Campaign Name *</label>
                <input value={campaignForm.name} onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="e.g. Post-Dinner Feedback" />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={campaignForm.description} onChange={e => setCampaignForm({ ...campaignForm, description: e.target.value })} placeholder="What is this campaign for?" rows={2} />
              </div>
              <div className="form-field">
                <label>Custom Question</label>
                <input value={campaignForm.question} onChange={e => setCampaignForm({ ...campaignForm, question: e.target.value })} placeholder="e.g. How was your dining experience?" />
                <span className="form-hint">Overrides the default review page heading for this campaign.</span>
              </div>
              <div className="form-field">
                <label>Google Review URL (optional)</label>
                <input value={campaignForm.google_review_url} onChange={e => setCampaignForm({ ...campaignForm, google_review_url: e.target.value })} placeholder="https://g.page/yourbusiness/review" />
                <span className="form-hint">Overrides the business-level Google URL for this campaign.</span>
              </div>
              <div className="form-field">
                <label>
                  <input type="checkbox" checked={campaignForm.is_active} onChange={e => setCampaignForm({ ...campaignForm, is_active: e.target.checked })} style={{ marginRight: 8 }} />
                  Campaign is active
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowCampaignForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={saveCampaign}>{editingCampaign ? 'Save Changes' : 'Create Campaign'}</button>
            </div>
          </div>
        </div>
      )}

      {followUpModal && (
        <div className="modal-overlay" onClick={() => setFollowUpModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Follow Up - {followUpModal.reviewer_name}</h3>
              <button onClick={() => setFollowUpModal(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="followup-review-summary">
                <div className="stars-row">{renderStars(followUpModal.rating, 20)}</div>
                {followUpModal.comment && <p>{followUpModal.comment}</p>}
                {followUpModal.customer_phone && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}><Phone size={12} /> {followUpModal.customer_phone}</div>}
                {followUpModal.customer_email && <div className="muted" style={{ fontSize: 13 }}><Mail size={12} /> {followUpModal.customer_email}</div>}
              </div>
              <div className="form-field">
                <label>Follow-up Status</label>
                <select value={followUpStatus} onChange={e => setFollowUpStatus(e.target.value as 'none' | 'pending' | 'contacted' | 'resolved')}>
                  <option value="none">No Action Needed</option>
                  <option value="pending">Pending - Needs Follow-up</option>
                  <option value="contacted">Contacted - Customer Reached</option>
                  <option value="resolved">Resolved - Issue Fixed</option>
                </select>
              </div>
              <div className="form-field">
                <label>Internal Notes</label>
                <textarea value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} placeholder="Notes about the follow-up (visible to your team only)" rows={4} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setFollowUpModal(null)}>Cancel</button>
              <button className="primary-btn" onClick={saveFollowUp} disabled={savingFollowUp}>
                {savingFollowUp ? <><Loader2 size={15} className="spin" /> Saving...</> : <><Check size={15} /> Save Follow-up</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestForm && (
        <div className="modal-overlay" onClick={() => setShowRequestForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Review Request</h3>
              <button onClick={() => setShowRequestForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Customer Name *</label>
                <input value={requestForm.customer_name} onChange={e => setRequestForm({ ...requestForm, customer_name: e.target.value })} placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Phone (for WhatsApp/SMS)</label>
                  <input value={requestForm.customer_phone} onChange={e => setRequestForm({ ...requestForm, customer_phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input value={requestForm.customer_email} onChange={e => setRequestForm({ ...requestForm, customer_email: e.target.value })} placeholder="customer@email.com" />
                </div>
              </div>
              <div className="form-field">
                <label>Channel</label>
                <select value={requestForm.channel} onChange={e => setRequestForm({ ...requestForm, channel: e.target.value as ReviewRequest['channel'] })}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="qr">QR Code</option>
                  <option value="link">Direct Link</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowRequestForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={sendRequest}><Send size={15} /> Send Request</button>
            </div>
          </div>
        </div>
      )}

      {showTemplateForm && (
        <div className="modal-overlay" onClick={() => setShowTemplateForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => setShowTemplateForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Template Name *</label>
                <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. WhatsApp Review Request" />
              </div>
              <div className="form-field">
                <label>Channel</label>
                <select value={templateForm.channel} onChange={e => setTemplateForm({ ...templateForm, channel: e.target.value as ReviewTemplate['channel'] })}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              {templateForm.channel === 'email' && (
                <div className="form-field">
                  <label>Subject</label>
                  <input value={templateForm.subject} onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Email subject" />
                </div>
              )}
              <div className="form-field">
                <label>Message Body *</label>
                <textarea value={templateForm.body} onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })} placeholder="Hi {{customer_name}}, thank you for choosing {{business_name}}. We'd love your feedback: {{review_link}}" rows={5} />
              </div>
              <p className="setup-hint">Variables: {'{{customer_name}}, {{business_name}}, {{review_link}}, {{service_name}}'}</p>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowTemplateForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={saveTemplate}>{editingTemplate ? 'Save Changes' : 'Create Template'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
