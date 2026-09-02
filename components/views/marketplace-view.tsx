'use client';

import { useEffect, useState } from 'react';
import { Check, Download, ImagePlus, Lock, Plus, Search, ShoppingBag, Star, X } from 'lucide-react';
import { supabase, type MarketplaceListing } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';
import { useAuth } from '@/lib/auth-context';
import { uploadImage } from '@/lib/upload';

type ListingInput = {
  title: string;
  category: 'template' | 'service' | 'addon' | 'theme';
  description: string;
  price: number | '';
  creator: string;
  image_url: string | null;
};

const emptyListing: ListingInput = { title: '', category: 'template', description: '', price: '', creator: '', image_url: null };

const categories = [
  { id: 'all', label: 'All' },
  { id: 'template', label: 'Templates' },
  { id: 'theme', label: 'Themes' },
  { id: 'service', label: 'Services' },
  { id: 'addon', label: 'Add-ons' },
];

export function MarketplaceView() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ListingInput>(emptyListing);
  const [toast, setToast] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImage = async (file: File) => {
    setUploading(true);
    const url = await uploadImage(file, 'marketplace');
    setUploading(false);
    if (url) {
      setForm(f => ({ ...f, image_url: url }));
      setToast('Image uploaded');
    } else {
      setToast('Image upload failed');
    }
    window.setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    (async () => {
      if (!user || !companyId) { setCanManage(false); return; }
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (isAdmin) { setCanManage(true); return; }
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .maybeSingle();
      setCanManage(member?.role === 'owner' || member?.role === 'admin');
    })();
  }, [user, companyId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false });
      setListings(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = listings.filter(l => {
    const matchCat = activeCategory === 'all' || l.category === activeCategory;
    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase()) || (l.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const save = async () => {
    if (!form.title) {
      setToast('Title is required');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    await supabase.from('marketplace_listings').insert({ ...form, price: form.price === '' ? 0 : form.price, status: 'active', company_id: companyId });
    setShowForm(false);
    setForm(emptyListing);
    const { data } = await supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false });
    setListings(data || []);
    setToast('Listing added to marketplace');
    window.setTimeout(() => setToast(''), 2500);
  };

  const download = (listing: MarketplaceListing) => {
    setToast(`Downloading ${listing.title}...`);
    window.setTimeout(() => setToast(''), 2500);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Marketplace</h2>
          <p className="page-subtitle">Browse templates, themes, services, and add-ons for your business{!canManage && ' — listing managed by admins'}</p>
        </div>
        {canManage && <button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={17} /> List Item</button>}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search marketplace..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          {categories.map(c => (
            <button key={c.id} className={activeCategory === c.id ? 'filter-active' : ''} onClick={() => setActiveCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading marketplace...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={48} />
          <h3>No items found</h3>
          <p>{search ? 'Try a different search.' : canManage ? 'Be the first to list an item on the marketplace.' : 'Check back soon for new items.'}</p>
        </div>
      ) : (
        <div className="marketplace-grid">
          {filtered.map(listing => (
            <div className="marketplace-card" key={listing.id}>
              <div className="marketplace-thumb" style={listing.image_url ? undefined : { background: `linear-gradient(135deg, ${listing.category === 'template' ? '#5648db' : listing.category === 'theme' ? '#7c3aed' : listing.category === 'service' ? '#0ea5e9' : '#f59e0b'}, ${listing.category === 'template' ? '#7c3aed' : listing.category === 'theme' ? '#9333ea' : listing.category === 'service' ? '#0284c7' : '#d97706'})` }}>
                {listing.image_url ? <img src={listing.image_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ShoppingBag size={32} />}
                {listing.price === 0 && <span className="marketplace-free-tag">FREE</span>}
              </div>
              <div className="marketplace-info">
                <div className="marketplace-cat">{listing.category}</div>
                <strong>{listing.title}</strong>
                {listing.description && <p>{listing.description}</p>}
                <div className="marketplace-meta">
                  <div className="marketplace-rating"><Star size={13} className="star-filled" /> {listing.rating.toFixed(1)}</div>
                  <span className="muted">{listing.downloads} downloads</span>
                </div>
                <div className="marketplace-footer">
                  <span className="marketplace-price">{listing.price === 0 ? 'Free' : `\u20b9${listing.price.toLocaleString('en-IN')}`}</span>
                  <button className="primary-btn sm" onClick={() => download(listing)}><Download size={14} /> Get</button>
                </div>
                {listing.creator && <span className="marketplace-creator">by {listing.creator}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>List on Marketplace</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Premium Business Card Template" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ListingInput['category'] })}>
                    <option value="template">Template</option>
                    <option value="theme">Theme</option>
                    <option value="service">Service</option>
                    <option value="addon">Add-on</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Price (&#8377;)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0 for free" />
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe what you're offering..." rows={3} />
              </div>
              <div className="form-field">
                <label>Creator Name</label>
                <input value={form.creator} onChange={e => setForm({ ...form, creator: e.target.value })} placeholder="Your name or business" />
              </div>
              <div className="form-field">
                <label>Product Image</label>
                <div className="image-upload-area">
                  {form.image_url ? (
                    <div className="image-preview">
                      <img src={form.image_url} alt="Preview" />
                      <button type="button" className="image-remove-btn" onClick={() => setForm({ ...form, image_url: null })}><X size={16} /></button>
                    </div>
                  ) : (
                    <label className="image-upload-label">
                      <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); }} />
                      <ImagePlus size={24} />
                      <span>{uploading ? 'Uploading...' : 'Browse and select image from your computer'}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={save}>List Item</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
