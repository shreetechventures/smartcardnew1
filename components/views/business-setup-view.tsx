'use client';

import { useEffect, useState } from 'react';
import { Check, Building2, User, Phone, MapPin, Globe, Share2, Sparkles, Upload, Loader2 } from 'lucide-react';
import { supabase, type BusinessProfile } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';
import { useCompanyId } from '@/hooks/use-company-id';

type ProfileInput = {
  business_name: string;
  tagline: string;
  owner_name: string;
  owner_title: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  about: string;
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  google_business: string;
  review_slug: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
};

const emptyProfile: ProfileInput = {
  business_name: '', tagline: '', owner_name: '', owner_title: '', email: '', phone: '',
  whatsapp: '', website: '', address: '', city: '', state: '', pincode: '', about: '',
  facebook: '', instagram: '', twitter: '', linkedin: '', youtube: '', google_business: '',
  review_slug: '', logo_url: '', primary_color: '#5648db', secondary_color: '#7c3aed',
};

export function BusinessSetupView() {
  const { companyId } = useCompanyId();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState<ProfileInput>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeSection, setActiveSection] = useState<'business' | 'contact' | 'social' | 'branding'>('business');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setToast('Image must be under 5MB'); window.setTimeout(() => setToast(''), 2500); return; }
    setUploadingLogo(true);
    const url = await uploadImage(file, 'logos');
    setUploadingLogo(false);
    if (url) { setForm({ ...form, logo_url: url }); setToast('Logo uploaded!'); }
    else { setToast('Upload failed. Please try again.'); }
    window.setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('business_profile').select('*').maybeSingle();
      if (data) {
        setProfile(data as BusinessProfile);
        setForm({
          business_name: data.business_name, tagline: data.tagline || '', owner_name: data.owner_name || '',
          owner_title: data.owner_title || '', email: data.email || '', phone: data.phone || '',
          whatsapp: data.whatsapp || '', website: data.website || '', address: data.address || '',
          city: data.city || '', state: data.state || '', pincode: data.pincode || '', about: data.about || '',
          facebook: data.facebook || '', instagram: data.instagram || '', twitter: data.twitter || '',
          linkedin: data.linkedin || '', youtube: data.youtube || '', google_business: data.google_business || '',
          review_slug: data.review_slug || '', logo_url: data.logo_url || '', primary_color: data.primary_color, secondary_color: data.secondary_color,
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!form.business_name) {
      setToast('Business name is required');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    setSaving(true);
    if (profile) {
      await supabase.from('business_profile').update({ ...form, updated_at: new Date().toISOString() }).eq('id', profile.id);
    } else {
      await supabase.from('business_profile').insert({ ...form, company_id: companyId });
    }
    setSaving(false);
    setToast('Business profile saved! All modules will use this information.');
    window.setTimeout(() => setToast(''), 3000);
  };

  const sections = [
    { key: 'business' as const, label: 'Business Info', icon: Building2 },
    { key: 'contact' as const, label: 'Contact & Address', icon: Phone },
    { key: 'social' as const, label: 'Social Links', icon: Share2 },
    { key: 'branding' as const, label: 'Branding', icon: Sparkles },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Business Setup</h2>
          <p className="page-subtitle">Enter your business information once — it powers every module in your dashboard</p>
        </div>
        <button className="primary-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : <><Check size={17} /> Save Profile</>}
        </button>
      </div>

      <div className="setup-info-banner">
        <Sparkles size={20} />
        <div>
          <strong>One-time setup, everywhere.</strong>
          <p>The information you enter here automatically fills your digital cards, AI posters, website builder, and marketplace listings.</p>
        </div>
      </div>

      <div className="setup-layout">
        <aside className="setup-sidebar">
          {sections.map(s => (
            <button key={s.key} className={`setup-tab ${activeSection === s.key ? 'active' : ''}`} onClick={() => setActiveSection(s.key)}>
              <s.icon size={18} /> {s.label}
            </button>
          ))}
        </aside>

        <div className="setup-content">
          {loading ? (
            <div className="empty-state">Loading your business profile...</div>
          ) : (
            <>
              {activeSection === 'business' && (
                <div className="setup-section">
                  <div className="setup-section-title"><Building2 size={20} /> Business Information</div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Business Name *</label>
                      <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="e.g. Shree Tech Ventures" />
                    </div>
                    <div className="form-field">
                      <label>Tagline</label>
                      <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="e.g. Smart Solutions for Smart Business" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Owner Name</label>
                      <input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="e.g. Sumit Jambure" />
                    </div>
                    <div className="form-field">
                      <label>Owner Title</label>
                      <input value={form.owner_title} onChange={e => setForm({ ...form, owner_title: e.target.value })} placeholder="e.g. Founder & CEO" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>About Your Business</label>
                    <textarea value={form.about} onChange={e => setForm({ ...form, about: e.target.value })} placeholder="Tell people what your business does..." rows={4} />
                  </div>
                  <div className="form-field">
                    <label>Review Page Handle</label>
                    <div className="handle-input-row">
                      <span className="handle-prefix">/review/</span>
                      <input value={form.review_slug} onChange={e => setForm({ ...form, review_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') })} placeholder="your-business" />
                    </div>
                    <p className="setup-hint">This is your unique review page URL. Customers leave reviews at this address. Use only lowercase letters, numbers, and hyphens.</p>
                  </div>
                </div>
              )}

              {activeSection === 'contact' && (
                <div className="setup-section">
                  <div className="setup-section-title"><Phone size={20} /> Contact & Address</div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Email</label>
                      <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contact@business.com" />
                    </div>
                    <div className="form-field">
                      <label>Phone</label>
                      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>WhatsApp</label>
                      <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="+91 98765 43210" />
                    </div>
                    <div className="form-field">
                      <label>Website</label>
                      <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="example.com" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Address</label>
                    <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street address" />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>City</label>
                      <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="e.g. Pune" />
                    </div>
                    <div className="form-field">
                      <label>State</label>
                      <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="e.g. Maharashtra" />
                    </div>
                    <div className="form-field">
                      <label>Pincode</label>
                      <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} placeholder="411001" />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'social' && (
                <div className="setup-section">
                  <div className="setup-section-title"><Share2 size={20} /> Social Media Links</div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Facebook</label>
                      <input value={form.facebook} onChange={e => setForm({ ...form, facebook: e.target.value })} placeholder="facebook.com/yourbusiness" />
                    </div>
                    <div className="form-field">
                      <label>Instagram</label>
                      <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="instagram.com/yourbusiness" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Twitter / X</label>
                      <input value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} placeholder="x.com/yourbusiness" />
                    </div>
                    <div className="form-field">
                      <label>LinkedIn</label>
                      <input value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} placeholder="linkedin.com/company/yourbusiness" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>YouTube</label>
                      <input value={form.youtube} onChange={e => setForm({ ...form, youtube: e.target.value })} placeholder="youtube.com/@yourchannel" />
                    </div>
                    <div className="form-field">
                      <label>Google Business</label>
                      <input value={form.google_business} onChange={e => setForm({ ...form, google_business: e.target.value })} placeholder="Google Business Profile URL" />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'branding' && (
                <div className="setup-section">
                  <div className="setup-section-title"><Sparkles size={20} /> Branding & Colors</div>
                  <div className="form-field">
                    <label>Business Logo</label>
                    <div className="upload-row">
                      <label className="upload-btn">
                        {uploadingLogo ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                        {uploadingLogo ? 'Uploading...' : 'Browse from PC / Mobile'}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
                      </label>
                      {form.logo_url && (
                        <div className="upload-preview-wrap">
                          <img src={form.logo_url} alt="Logo preview" className="upload-preview" />
                          <button className="upload-remove" onClick={() => setForm({ ...form, logo_url: '' })}>&times;</button>
                        </div>
                      )}
                    </div>
                    <input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="Or paste an image URL..." />
                  </div>
                  <p className="setup-hint">These colors are used across your cards, posters, and website automatically.</p>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Primary Color</label>
                      <div className="color-picker-row">
                        <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="color-input" />
                        <input value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} placeholder="#5648db" />
                      </div>
                    </div>
                    <div className="form-field">
                      <label>Secondary Color</label>
                      <div className="color-picker-row">
                        <input type="color" value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} className="color-input" />
                        <input value={form.secondary_color} onChange={e => setForm({ ...form, secondary_color: e.target.value })} placeholder="#7c3aed" />
                      </div>
                    </div>
                  </div>
                  <div className="branding-preview">
                    <div className="branding-preview-card" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}>
                      <Building2 size={32} />
                      <strong>{form.business_name || 'Your Business'}</strong>
                      <span>{form.tagline || 'Your tagline appears here'}</span>
                      <div className="branding-preview-cta" style={{ background: 'rgba(255,255,255,.2)' }}>{form.owner_name || 'Owner Name'} - {form.owner_title || 'Title'}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
