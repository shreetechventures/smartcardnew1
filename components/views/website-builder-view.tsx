'use client';

import { useEffect, useState } from 'react';
import { Check, Edit3, ExternalLink, Globe, Plus, Rocket, Trash2, X } from 'lucide-react';
import { supabase, type Website, type BusinessProfile } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type WebsiteInput = {
  site_name: string;
  domain: string;
  template: string;
  hero_title: string;
  hero_subtitle: string;
  services: string;
};

const emptyWebsite: WebsiteInput = {
  site_name: '', domain: '', template: 'business', hero_title: '', hero_subtitle: '', services: '',
};

const slugify = (name: string) => name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const templates = [
  { id: 'business', name: 'Business', desc: 'Professional landing page' },
  { id: 'portfolio', name: 'Portfolio', desc: 'Showcase your work' },
  { id: 'store', name: 'Store', desc: 'Product catalog' },
  { id: 'restaurant', name: 'Restaurant', desc: 'Menu & reservations' },
];

const sectionOptions = ['hero', 'about', 'services', 'gallery', 'contact', 'reviews', 'map'];

export function WebsiteBuilderView() {
  const { companyId } = useCompanyId();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Website | null>(null);
  const [form, setForm] = useState<WebsiteInput>(emptyWebsite);
  const [sections, setSections] = useState<string[]>(['hero', 'about', 'services', 'contact']);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const [w, bp] = await Promise.all([
        supabase.from('websites').select('*').order('created_at', { ascending: false }),
        supabase.from('business_profile').select('*').maybeSingle(),
      ]);
      setWebsites(w.data || []);
      setProfile(bp.data as BusinessProfile | null);
      setLoading(false);
    })();
  }, []);

  const prefillFromProfile = () => {
    if (!profile) {
      setToast('Set up your business profile first');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    setForm({
      ...emptyWebsite,
      site_name: profile.business_name,
      domain: `thesmartcard.in/site/${slugify(profile.business_name)}`,
      hero_title: profile.business_name,
      hero_subtitle: profile.tagline || profile.about?.slice(0, 100) || '',
      services: profile.about || '',
    });
    setToast('Auto-filled from your business profile!');
    window.setTimeout(() => setToast(''), 2500);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyWebsite);
    setSections(['hero', 'about', 'services', 'contact']);
    setShowForm(true);
  };

  const openEdit = (site: Website) => {
    setEditing(site);
    setForm({
      site_name: site.site_name, domain: site.domain || '', template: site.template,
      hero_title: site.hero_title || '', hero_subtitle: site.hero_subtitle || '', services: site.services || '',
    });
    setSections(site.sections);
    setShowForm(true);
  };

  const toggleSection = (section: string) => {
    setSections(sections.includes(section) ? sections.filter(s => s !== section) : [...sections, section]);
  };

  const save = async () => {
    if (!form.site_name) {
      setToast('Site name is required');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    const slug = slugify(form.site_name);
    const payload = { ...form, slug, sections };
    if (editing) {
      await supabase.from('websites').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      setToast('Website updated');
    } else {
      await supabase.from('websites').insert({ ...payload, company_id: companyId });
      setToast('Website created');
    }
    setShowForm(false);
    const { data } = await supabase.from('websites').select('*').order('created_at', { ascending: false });
    setWebsites(data || []);
    window.setTimeout(() => setToast(''), 2500);
  };

  const togglePublish = async (site: Website) => {
    await supabase.from('websites').update({ is_published: !site.is_published, updated_at: new Date().toISOString() }).eq('id', site.id);
    const { data } = await supabase.from('websites').select('*').order('created_at', { ascending: false });
    setWebsites(data || []);
    setToast(site.is_published ? 'Website unpublished' : 'Website published!');
    window.setTimeout(() => setToast(''), 2500);
  };

  const remove = async (id: string) => {
    await supabase.from('websites').delete().eq('id', id);
    setWebsites(websites.filter(w => w.id !== id));
    setToast('Website deleted');
    window.setTimeout(() => setToast(''), 2500);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Website Builder</h2>
          <p className="page-subtitle">Build a professional website using your business profile data</p>
        </div>
        <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Create Website</button>
      </div>

      {!profile && (
        <div className="setup-info-banner">
          <Globe size={20} />
          <div>
            <strong>Complete your Business Setup first</strong>
            <p>Your business name, about text, and contact info will auto-fill into your website.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading your websites...</div>
      ) : websites.length === 0 ? (
        <div className="empty-state">
          <Globe size={48} />
          <h3>No websites yet</h3>
          <p>Create your first website — it pulls data from your business profile automatically.</p>
          <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Create Website</button>
        </div>
      ) : (
        <div className="websites-grid">
          {websites.map(site => (
            <div className="website-card" key={site.id}>
              <div className="website-preview" style={{ background: `linear-gradient(135deg, ${profile?.primary_color || '#5648db'}, ${profile?.secondary_color || '#7c3aed'})` }}>
                <Globe size={28} />
                <strong>{site.site_name}</strong>
                <span>{site.slug ? `thesmartcard.in/site/${site.slug}` : 'No slug set'}</span>
                <div className="website-template-tag">{site.template}</div>
              </div>
              <div className="website-info">
                <div className="website-meta">
                  <span className={`status-badge ${site.is_published ? 'active' : 'inactive'}`}><span className="dot" />{site.is_published ? 'Published' : 'Draft'}</span>
                  <span className="muted">{site.sections.length} sections</span>
                </div>
                <div className="website-actions">
                  <button className="ghost-btn sm" onClick={() => openEdit(site)}><Edit3 size={13} /> Edit</button>
                  <button className="ghost-btn sm" onClick={() => togglePublish(site)}>
                    {site.is_published ? <><X size={13} /> Unpublish</> : <><Rocket size={13} /> Publish</>}
                  </button>
                  {site.is_published && site.slug && (
                    <button className="ghost-btn sm" onClick={() => window.open(`/site/${site.slug}`, '_blank')}><ExternalLink size={13} /> Visit</button>
                  )}
                  <button className="ghost-btn sm danger" onClick={() => remove(site.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Website' : 'Create Website'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <button className="prefill-btn" onClick={prefillFromProfile}>
                <Globe size={16} /> Auto-fill from Business Profile
              </button>

              <div className="form-row">
                <div className="form-field">
                  <label>Site Name *</label>
                  <input value={form.site_name} onChange={e => setForm({ ...form, site_name: e.target.value })} placeholder="e.g. Shree Tech Ventures" />
                </div>
                <div className="form-field">
                  <label>Custom Domain</label>
                  <input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="thesmartcard.in/site/yourbusiness" />
                  <span className="form-hint">Your website will be accessible at this URL. Auto-generated from your business name.</span>
                </div>
              </div>

              <div className="form-field">
                <label>Template</label>
                <div className="template-grid">
                  {templates.map(t => (
                    <button key={t.id} className={`template-option ${form.template === t.id ? 'selected' : ''}`} onClick={() => setForm({ ...form, template: t.id })}>
                      <strong>{t.name}</strong>
                      <span>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Hero Title</label>
                <input value={form.hero_title} onChange={e => setForm({ ...form, hero_title: e.target.value })} placeholder="Main headline" />
              </div>
              <div className="form-field">
                <label>Hero Subtitle</label>
                <input value={form.hero_subtitle} onChange={e => setForm({ ...form, hero_subtitle: e.target.value })} placeholder="Supporting text" />
              </div>
              <div className="form-field">
                <label>Services / About Content</label>
                <textarea value={form.services} onChange={e => setForm({ ...form, services: e.target.value })} placeholder="Describe your services..." rows={3} />
              </div>

              <div className="form-field">
                <label>Page Sections</label>
                <div className="section-toggle-grid">
                  {sectionOptions.map(s => (
                    <button key={s} className={`section-toggle ${sections.includes(s) ? 'active' : ''}`} onClick={() => toggleSection(s)}>
                      <Check size={13} /> {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={save}>{editing ? 'Save Changes' : 'Create Website'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
