'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  CreditCard,
  Eye,
  Link2,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Trash2,
  Upload,
  Video,
  X,
  Loader2,
} from 'lucide-react';
import { supabase, type Card, type Product } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';
import { useCompanyId } from '@/hooks/use-company-id';

type CardInput = {
  name: string;
  handle: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  bio: string;
  photo_url: string;
  logo_url: string;
  video_url: string;
  upi_id: string;
  status: 'active' | 'inactive';
};

const emptyCard: CardInput = {
  name: '', handle: '', title: '', company: '', phone: '', email: '', whatsapp: '', website: '', bio: '',
  photo_url: '', logo_url: '', video_url: '', upi_id: '', status: 'active',
};

export function CardsView() {
  const { companyId, loading: companyLoading } = useCompanyId();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [form, setForm] = useState<CardInput>(emptyCard);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showProducts, setShowProducts] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: 0, image_url: '', category: '', is_available: true });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cardLimit, setCardLimit] = useState<{ max_cards: number; current_cards: number; plan_id: string } | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setToast('Image must be under 5MB'); window.setTimeout(() => setToast(''), 2500); return; }
    setUploadingPhoto(true);
    const url = await uploadImage(file, 'photos');
    setUploadingPhoto(false);
    if (url) { setForm({ ...form, photo_url: url }); setToast('Profile photo uploaded!'); }
    else { setToast('Upload failed. Please try again.'); }
    window.setTimeout(() => setToast(''), 2500);
  };

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

  const fetchCards = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [cardsRes, limitRes] = await Promise.all([
      supabase.from('cards').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.rpc('check_card_limit', { p_company_id: companyId }),
    ]);
    setCards(cardsRes.data || []);
    if (limitRes.data) {
      const d = limitRes.data as { allowed: boolean; max_cards: number; current_cards: number; plan_id: string };
      setCardLimit({ max_cards: d.max_cards, current_cards: d.current_cards, plan_id: d.plan_id });
    }
    setLoading(false);
  };

  useEffect(() => { fetchCards(); }, [companyId]);

  const filtered = cards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.handle.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    if (cardLimit && cardLimit.current_cards >= cardLimit.max_cards) {
      setToast(`Your ${cardLimit.plan_id} plan allows ${cardLimit.max_cards} card${cardLimit.max_cards !== 1 ? 's' : ''}. Upgrade to create more.`);
      window.setTimeout(() => setToast(''), 3500);
      return;
    }
    setEditing(null);
    setForm(emptyCard);
    setShowForm(true);
  };

  const openEdit = (card: Card) => {
    setEditing(card);
    setForm({
      name: card.name, handle: card.handle, title: card.title || '', company: card.company || '',
      phone: card.phone || '', email: card.email || '', whatsapp: card.whatsapp || '', website: card.website || '',
      bio: card.bio || '', photo_url: card.photo_url || '', logo_url: card.logo_url || '', video_url: card.video_url || '', upi_id: card.upi_id || '',
      status: card.status,
    });
    setShowForm(true);
    setMenuOpen(null);
  };

  const save = async () => {
    if (!form.name || !form.handle) {
      setToast('Name and handle are required');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    if (!companyId) {
      setToast('Unable to create card. Please refresh the page and try again.');
      window.setTimeout(() => setToast(''), 3500);
      return;
    }
    if (editing) {
      const { error: updateError } = await supabase.from('cards').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (updateError) {
        setToast('Failed to update card. Please try again.');
        window.setTimeout(() => setToast(''), 2500);
        return;
      }
      setToast('Card updated successfully');
    } else {
      const { data: limitCheck } = await supabase.rpc('check_card_limit', { p_company_id: companyId });
      const d = limitCheck as { allowed: boolean; max_cards: number; current_cards: number } | null;
      if (d && !d.allowed) {
        setToast(`Card limit reached. Your plan allows ${d.max_cards} card${d.max_cards !== 1 ? 's' : ''}. Upgrade to create more.`);
        window.setTimeout(() => setToast(''), 3500);
        return;
      }
      const { error } = await supabase.from('cards').insert({ ...form, company_id: companyId });
      if (error) {
        setToast(error.message || 'Failed to create card. Please try again.');
        window.setTimeout(() => setToast(''), 3500);
        return;
      }
      setToast('Card created successfully');
    }
    setShowForm(false);
    setForm(emptyCard);
    setEditing(null);
    fetchCards();
    window.setTimeout(() => setToast(''), 2500);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('cards').delete().eq('id', id);
    setMenuOpen(null);
    if (error) {
      setToast('Failed to delete card. Please try again.');
    } else {
      setToast('Card deleted');
    }
    fetchCards();
    window.setTimeout(() => setToast(''), 2500);
  };

  const openProducts = async (cardId: string) => {
    setShowProducts(cardId);
    setMenuOpen(null);
    const { data } = await supabase.from('products').select('*').eq('card_id', cardId).order('sort_order', { ascending: true });
    setProducts(data || []);
  };

  const openProductCreate = () => {
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: 0, image_url: '', category: '', is_available: true });
    setShowProductForm(true);
  };

  const openProductEdit = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name, description: product.description || '', price: product.price,
      image_url: product.image_url || '', category: product.category || '', is_available: product.is_available,
    });
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!productForm.name) {
      setToast('Product name is required');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    if (editingProduct) {
      const { error } = await supabase.from('products').update({ ...productForm, updated_at: new Date().toISOString() }).eq('id', editingProduct.id);
      if (error) { setToast('Failed to update product.'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Product updated');
    } else {
      const { error } = await supabase.from('products').insert({ ...productForm, card_id: showProducts, company_id: companyId });
      if (error) { setToast('Failed to add product.'); window.setTimeout(() => setToast(''), 2500); return; }
      setToast('Product added');
    }
    setShowProductForm(false);
    const { data } = await supabase.from('products').select('*').eq('card_id', showProducts).order('sort_order', { ascending: true });
    setProducts(data || []);
    window.setTimeout(() => setToast(''), 2500);
  };

  const removeProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(products.filter(p => p.id !== id));
    setToast('Product removed');
    window.setTimeout(() => setToast(''), 2500);
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Cards</h2>
          <p className="page-subtitle">Create and manage your digital business cards with logo, video, UPI, and product menu</p>
          {cardLimit && (
            <div className="plan-usage-badge">
              <CreditCard size={14} />
              <span>{cardLimit.current_cards} / {cardLimit.max_cards} cards used</span>
              <span className="plan-usage-plan">{cardLimit.plan_id} plan</span>
            </div>
          )}
        </div>
        <button className="primary-btn" onClick={openCreate}
          style={cardLimit && cardLimit.current_cards >= cardLimit.max_cards ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        >
          {cardLimit && cardLimit.current_cards >= cardLimit.max_cards ? <><Lock size={17} /> Limit Reached</> : <><Plus size={17} /> Create New Card</>}
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search cards by name, handle, or company..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toolbar-info">{filtered.length} card{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {(loading || companyLoading) ? (
        <div className="empty-state">Loading your cards...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={48} />
          <h3>No cards found</h3>
          <p>{search ? 'Try a different search.' : 'Create your first digital business card to get started.'}</p>
          {!search && cardLimit && cardLimit.current_cards < cardLimit.max_cards && <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Create New Card</button>}
        </div>
      ) : (
        <div className="cards-grid">
          {filtered.map(card => (
            <div className="card-item" key={card.id}>
              <div className="card-item-top">
                <div className="card-item-avatar-wrap">
                  {card.logo_url ? (
                    <img src={card.logo_url} alt={card.name} className="card-item-logo" />
                  ) : (
                    <div className="card-item-avatar">{initials(card.name)}</div>
                  )}
                </div>
                <div className="card-item-info">
                  <strong>{card.name}</strong>
                  <span>{card.title || '—'}{card.company ? ` · ${card.company}` : ''}</span>
                </div>
                <div className="card-item-menu">
                  <button onClick={() => setMenuOpen(menuOpen === card.id ? null : card.id)} aria-label="Card menu"><MoreVertical size={18} /></button>
                  {menuOpen === card.id && (
                    <div className="menu-dropdown">
                      <button onClick={() => openEdit(card)}><Pencil size={14} /> Edit</button>
                      <button onClick={() => openProducts(card.id)}><ShoppingBag size={14} /> Product Menu</button>
                      <button onClick={() => remove(card.id)} className="danger"><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="card-item-handle">@{card.handle}</div>
              <div className="card-item-details">
                {card.email && <span>{card.email}</span>}
                {card.phone && <span>{card.phone}</span>}
              </div>
              <div className="card-item-badges">
                {card.video_url && <span className="card-badge video"><Video size={11} /> Video</span>}
                {card.upi_id && <span className="card-badge upi"><CreditCard size={11} /> UPI</span>}
                <span className="card-badge products"><ShoppingBag size={11} /> Products</span>
              </div>
              <div className="card-item-footer">
                <span className={`status-badge ${card.status}`}><span className="dot" />{card.status === 'active' ? 'Active' : 'Inactive'}</span>
                <span className="views-count"><Eye size={14} /> {card.views} views</span>
                <button className="share-btn" onClick={() => {
                  const url = `${window.location.origin}/card/${card.handle}`;
                  if (navigator.share) {
                    navigator.share({ title: card.name, text: `Check out my digital business card`, url }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(url);
                    setToast('Card link copied to clipboard');
                    window.setTimeout(() => setToast(''), 2500);
                  }
                }}><Share2 size={14} /> Share</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Card' : 'Create New Card'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Full Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sumit Jambure" />
                </div>
                <div className="form-field">
                  <label>Handle *</label>
                  <input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="e.g. sumit-jambure" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Job Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Founder & CEO" />
                </div>
                <div className="form-field">
                  <label>Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Shree Tech Ventures" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
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

              <div className="form-section-divider">Card Enhancements</div>

              <div className="form-row">
                <div className="form-field">
                  <label>Profile Photo</label>
                  <div className="upload-row">
                    <label className="upload-btn">
                      {uploadingPhoto ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                      {uploadingPhoto ? 'Uploading...' : 'Browse from PC / Mobile'}
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
                    </label>
                    {form.photo_url && (
                      <div className="upload-preview-wrap">
                        <img src={form.photo_url} alt="Preview" className="upload-preview" />
                        <button className="upload-remove" onClick={() => setForm({ ...form, photo_url: '' })}>&times;</button>
                      </div>
                    )}
                  </div>
                  <input value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} placeholder="Or paste an image URL..." />
                </div>
                <div className="form-field">
                  <label>Company Logo</label>
                  <div className="upload-row">
                    <label className="upload-btn">
                      {uploadingLogo ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                      {uploadingLogo ? 'Uploading...' : 'Browse from PC / Mobile'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
                    </label>
                    {form.logo_url && (
                      <div className="upload-preview-wrap">
                        <img src={form.logo_url} alt="Preview" className="upload-preview" />
                        <button className="upload-remove" onClick={() => setForm({ ...form, logo_url: '' })}>&times;</button>
                      </div>
                    )}
                  </div>
                  <input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="Or paste an image URL..." />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>UPI ID</label>
                  <input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="business@upi" />
                </div>
              </div>
              <div className="form-field">
                <label>Video Intro URL (YouTube)</label>
                <input value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
              </div>

              <div className="form-field">
                <label>Bio</label>
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="A short bio about you or your business..." rows={3} />
              </div>
              <div className="form-field">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={save}>{editing ? 'Save Changes' : 'Create Card'}</button>
            </div>
          </div>
        </div>
      )}

      {showProducts && (
        <div className="modal-overlay" onClick={() => setShowProducts(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><ShoppingBag size={18} /> Product Menu</h3>
              <button onClick={() => setShowProducts(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="products-modal-header">
                <p className="setup-hint">Add products or services that will appear on your digital card for customers to browse.</p>
                <button className="primary-btn sm" onClick={openProductCreate}><Plus size={14} /> Add Product</button>
              </div>
              {products.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <ShoppingBag size={36} />
                  <p>No products yet. Add your first product to show on the card.</p>
                </div>
              ) : (
                <div className="products-list">
                  {products.map(product => (
                    <div className="product-row" key={product.id}>
                      <div className="product-thumb">
                        {product.image_url ? <img src={product.image_url} alt={product.name} /> : <ShoppingBag size={20} />}
                      </div>
                      <div className="product-info">
                        <strong>{product.name}</strong>
                        {product.description && <span>{product.description}</span>}
                        {product.category && <span className="product-cat-tag">{product.category}</span>}
                      </div>
                      <div className="product-price-col">
                        <strong>&#8377;{Number(product.price).toLocaleString('en-IN')}</strong>
                        <span className={`product-avail ${product.is_available ? 'yes' : 'no'}`}>{product.is_available ? 'Available' : 'Unavailable'}</span>
                      </div>
                      <div className="product-actions">
                        <button className="ghost-btn sm" onClick={() => openProductEdit(product)}><Pencil size={12} /> Edit</button>
                        <button className="ghost-btn sm danger" onClick={() => removeProduct(product.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showProductForm && (
        <div className="modal-overlay" onClick={() => setShowProductForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowProductForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Product Name *</label>
                <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g. Web Design Service" />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} placeholder="Short description..." rows={2} />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Price (&#8377;)</label>
                  <input type="number" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: Number(e.target.value) })} placeholder="0 for free" />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <input value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} placeholder="e.g. Services" />
                </div>
              </div>
              <div className="form-field">
                <label>Image URL</label>
                <input value={productForm.image_url} onChange={e => setProductForm({ ...productForm, image_url: e.target.value })} placeholder="https://...image.jpg" />
              </div>
              <div className="form-field">
                <label>Availability</label>
                <select value={productForm.is_available ? 'yes' : 'no'} onChange={e => setProductForm({ ...productForm, is_available: e.target.value === 'yes' })}>
                  <option value="yes">Available</option>
                  <option value="no">Unavailable</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowProductForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={saveProduct}>{editingProduct ? 'Save Changes' : 'Add Product'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
