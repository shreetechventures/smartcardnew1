'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, MessageCircle, MoreVertical, Plus, QrCode, Settings2, Share2, Star, Trash2, X } from 'lucide-react';
import { supabase, type BusinessProfile, type ReviewTemplate } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type Tab = 'templates' | 'share' | 'routing';

export function ReviewsView() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const [tab, setTab] = useState<Tab>('templates');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', body: '' });
  const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
  const [routingRules, setRoutingRules] = useState({ id: '', positive: 'google', neutral: 'feedback', negative: 'feedback' });
  const [savingRouting, setSavingRouting] = useState(false);

  const reviewSlug = profile?.review_slug;
  const reviewLink = reviewSlug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/review/${reviewSlug}` : '';

  const fetchAll = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [bp, rt, rr] = await Promise.all([
      supabase.from('business_profile').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('review_templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('review_routing_rules').select('*').eq('company_id', companyId).maybeSingle(),
    ]);
    setProfile(bp.data as BusinessProfile | null);
    setTemplates(rt.data || []);
    if (rr.data) setRoutingRules(rr.data as typeof routingRules);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [companyId]);

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) { setToast('Template name and message are required'); window.setTimeout(() => setToast(''), 2500); return; }
    if (!companyId) { setToast('Unable to save template. Please refresh.'); window.setTimeout(() => setToast(''), 3500); return; }
    if (editingTemplate) {
      const { error } = await supabase.from('review_templates').update({ name: templateForm.name, body: templateForm.body, channel: 'whatsapp', updated_at: new Date().toISOString() }).eq('id', editingTemplate.id);
      if (error) { setToast('Failed to update template'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Template updated');
    } else {
      const { error } = await supabase.from('review_templates').insert({ name: templateForm.name, body: templateForm.body, channel: 'whatsapp', company_id: companyId });
      if (error) { setToast('Failed to create template'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Template created');
    }
    setShowTemplateForm(false); setEditingTemplate(null);
    setTemplateForm({ name: '', body: '' });
    const { data } = await supabase.from('review_templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    setTemplates(data || []);
    window.setTimeout(() => setToast(''), 2500);
  };

  const openTemplateEdit = (t: ReviewTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, body: t.body });
    setShowTemplateForm(true);
  };

  const removeTemplate = async (id: string) => {
    const { error } = await supabase.from('review_templates').delete().eq('id', id);
    if (error) { setToast('Failed to delete template'); window.setTimeout(() => setToast(''), 2500); return; }
    setTemplates(templates.filter(t => t.id !== id));
    setToast('Template deleted'); window.setTimeout(() => setToast(''), 2500);
  };

  const qrImageUrl = reviewLink ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(reviewLink)}` : '';

  const downloadQR = () => {
    if (!qrImageUrl) return;
    fetch(qrImageUrl).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reviewSlug || 'review'}-qr-code.png`;
      a.click();
      URL.revokeObjectURL(url);
      setToast('QR code downloaded'); window.setTimeout(() => setToast(''), 2500);
    }).catch(() => { setToast('Failed to download QR code'); window.setTimeout(() => setToast(''), 2500); });
  };

  const tabs: { key: Tab; label: string; icon: typeof Star }[] = [
    { key: 'templates', label: 'Templates', icon: MessageCircle },
    { key: 'share', label: 'Share & QR', icon: QrCode },
    { key: 'routing', label: 'Routing', icon: Settings2 },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Smart Review System</h2>
          <p className="page-subtitle">Collect feedback, route happy customers to Google with ready-to-paste review messages</p>
        </div>
        <div className="review-header-actions">
          {tab === 'templates' && <button className="primary-btn" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', body: '' }); setShowTemplateForm(true); }}><Plus size={17} /> New Template</button>}
        </div>
      </div>

      <div className="review-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`review-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <>
          {loading ? (
            <div className="empty-state">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={48} />
              <h3>No templates yet</h3>
              <p>Create ready-to-paste review messages that customers can copy and post on Google. These appear on your review page when customers rate you.</p>
              <button className="primary-btn" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', body: '' }); setShowTemplateForm(true); }}><Plus size={17} /> New Template</button>
            </div>
          ) : (
            <div className="templates-grid">
              {templates.map(t => (
                <div className="template-card" key={t.id}>
                  <div className="template-card-top">
                    <strong>{t.name}</strong>
                    <div className="card-item-menu">
                      <button onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}><MoreVertical size={18} /></button>
                      {menuOpen === t.id && (
                        <div className="menu-dropdown">
                          <button onClick={() => { navigator.clipboard.writeText(t.body); setToast('Template copied'); window.setTimeout(() => setToast(''), 2000); setMenuOpen(null); }}><Copy size={14} /> Copy</button>
                          <button onClick={() => openTemplateEdit(t)}><MessageCircle size={14} /> Edit</button>
                          <button onClick={() => removeTemplate(t.id)} className="danger"><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="template-body">{t.body}</p>
                  <div className="template-actions">
                    <button className="ghost-btn sm" onClick={() => { navigator.clipboard.writeText(t.body); setToast('Template copied'); window.setTimeout(() => setToast(''), 2000); }}><Copy size={12} /> Copy</button>
                    <button className="ghost-btn sm" onClick={() => openTemplateEdit(t)}><MessageCircle size={12} /> Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'share' && (
        <div className="setup-section" style={{ maxWidth: 560 }}>
          <div className="setup-section-title"><QrCode size={20} /> Share Your Review Page</div>
          <p className="setup-hint">Share this link or QR code with your customers. They scan it, rate your business, pick a review message, copy it, and paste it on your Google Business profile.</p>

          {!reviewSlug ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>Set your review page handle in Business Setup first to generate your review link and QR code.</p>
            </div>
          ) : (
            <>
              <div className="qr-share-preview">
                {qrImageUrl && (
                  <div className="qr-share-visual">
                    <img src={qrImageUrl} alt="Review QR Code" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                )}
                <div className="qr-share-info">
                  <div className="form-field">
                    <label>Your Review Link</label>
                    <div className="handle-input-row">
                      <input value={reviewLink} readOnly style={{ flex: 1 }} />
                      <button className="ghost-btn" onClick={() => { navigator.clipboard.writeText(reviewLink); setToast('Link copied'); window.setTimeout(() => setToast(''), 2000); }}><Copy size={15} /> Copy</button>
                    </div>
                  </div>
                  <div className="qr-share-actions">
                    <button className="primary-btn" onClick={downloadQR}><Download size={16} /> Download QR Code</button>
                    <button className="ghost-btn" onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `Review ${profile?.business_name || 'us'}`, text: `We'd love your feedback!`, url: reviewLink }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(reviewLink);
                        setToast('Link copied to clipboard'); window.setTimeout(() => setToast(''), 2000);
                      }
                    }}><Share2 size={16} /> Share Link</button>
                  </div>
                  <p className="setup-hint">Print the QR code and place it at your reception, billing counter, or packaging. Customers scan it and go straight to your review page.</p>
                </div>
              </div>
            </>
          )}
        </div>
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

      {showTemplateForm && (
        <div className="modal-overlay" onClick={() => setShowTemplateForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTemplate ? 'Edit Template' : 'New Review Message'}</h3>
              <button onClick={() => setShowTemplateForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Template Name *</label>
                <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Great Service Review" />
              </div>
              <div className="form-field">
                <label>Review Message *</label>
                <textarea value={templateForm.body} onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })} placeholder="I had an excellent experience with [Business Name]. The service was professional and the staff was very helpful. Highly recommend!" rows={5} />
                <span className="form-hint">This message will appear on your review page for customers to copy and paste on Google.</span>
              </div>
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
