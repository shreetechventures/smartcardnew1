'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Award, Check, ChevronDown, ChevronUp, ImagePlus, MessageSquareQuote, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { supabase, type BusinessCertificate, type BusinessClient, type BusinessGalleryItem, type BusinessService, type BusinessStatistic, type BusinessTestimonial } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';
import { uploadImage } from '@/lib/upload';

type ShowcaseTab = 'services' | 'gallery' | 'certificates' | 'clients' | 'testimonials' | 'statistics';
type ShowcaseRow = BusinessService | BusinessGalleryItem | BusinessCertificate | BusinessClient | BusinessTestimonial | BusinessStatistic;

type ServiceForm = { name: string; description: string; image_url: string; starting_price: string; cta_label: string; cta_link: string };
type GalleryForm = { image_url: string; title: string; description: string };
type CertificateForm = { image_url: string; name: string; issuing_organization: string; year: string };
type ClientForm = { name: string; logo_url: string; description: string };
type TestimonialForm = { customer_name: string; testimonial_text: string; rating: string; avatar_url: string };
type StatisticForm = { stat_value: string; stat_label: string; icon: string };

type FormState = ServiceForm | GalleryForm | CertificateForm | ClientForm | TestimonialForm | StatisticForm;

const tabItems: { key: ShowcaseTab; label: string; description: string; icon: typeof Award }[] = [
  { key: 'services', label: 'Services', description: 'What you offer', icon: Award },
  { key: 'gallery', label: 'Gallery', description: 'Show your work', icon: ImagePlus },
  { key: 'certificates', label: 'Certificates', description: 'Build trust', icon: Award },
  { key: 'clients', label: 'Trusted By', description: 'Client logos', icon: Users },
  { key: 'testimonials', label: 'Testimonials', description: 'Customer love', icon: MessageSquareQuote },
  { key: 'statistics', label: 'Statistics', description: 'Your proof points', icon: ChevronUp },
];

const emptyForms: Record<ShowcaseTab, FormState> = {
  services: { name: '', description: '', image_url: '', starting_price: '', cta_label: 'Get Quote', cta_link: '' },
  gallery: { image_url: '', title: '', description: '' },
  certificates: { image_url: '', name: '', issuing_organization: '', year: '' },
  clients: { name: '', logo_url: '', description: '' },
  testimonials: { customer_name: '', testimonial_text: '', rating: '5', avatar_url: '' },
  statistics: { stat_value: '', stat_label: '', icon: 'award' },
};

const tableByTab: Record<ShowcaseTab, string> = {
  services: 'business_services',
  gallery: 'business_gallery',
  certificates: 'business_certificates',
  clients: 'business_clients',
  testimonials: 'business_testimonials',
  statistics: 'business_statistics',
};

export function ShowcaseView() {
  const { companyId } = useCompanyId();
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('services');
  const [rows, setRows] = useState<ShowcaseRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForms.services);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeItem = useMemo(() => tabItems.find(item => item.key === activeTab) || tabItems[0], [activeTab]);

  useEffect(() => {
    setForm(emptyForms[activeTab]);
    setEditingId(null);
    void loadRows(activeTab);
  }, [activeTab, companyId]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadRows = async (tab: ShowcaseTab) => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.from(tableByTab[tab]).select('*').eq('company_id', companyId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) showToast('Could not load this section.');
    setRows((data as ShowcaseRow[]) || []);
    setLoading(false);
  };

  const updateForm = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value } as FormState));

  const handleUpload = async (file: File, field: 'image_url' | 'logo_url' | 'avatar_url') => {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Please choose an image smaller than 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file, 'photos');
      if (!url) throw new Error('Upload did not return a URL');
      updateForm(field, url);
    } catch {
      showToast('Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setSaving(true);
    const source = form as Record<string, string>;
    const payload: Record<string, string | number | boolean | null> = { company_id: companyId, is_enabled: true };
    Object.entries(source).forEach(([key, value]) => {
      if (key === 'starting_price') payload[key] = value ? Number(value) : null;
      else if (key === 'year') payload[key] = value ? Number(value) : null;
      else if (key === 'rating') payload[key] = Math.min(5, Math.max(1, Number(value) || 5));
      else payload[key] = value.trim() || null;
    });
    if (!editingId) payload.sort_order = rows.length;
    const query = supabase.from(tableByTab[activeTab]);
    const result = editingId ? await query.update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId) : await query.insert(payload);
    if (result.error) showToast('Could not save this item.');
    else {
      showToast(editingId ? 'Item updated.' : 'Item added to your card.');
      setForm(emptyForms[activeTab]);
      setEditingId(null);
      await loadRows(activeTab);
    }
    setSaving(false);
  };

  const edit = (row: ShowcaseRow) => {
    setEditingId(row.id);
    if (activeTab === 'services') {
      const item = row as BusinessService;
      setForm({ name: item.name, description: item.description || '', image_url: item.image_url || '', starting_price: item.starting_price?.toString() || '', cta_label: item.cta_label || 'Get Quote', cta_link: item.cta_link || '' });
    } else if (activeTab === 'gallery') {
      const item = row as BusinessGalleryItem;
      setForm({ image_url: item.image_url, title: item.title || '', description: item.description || '' });
    } else if (activeTab === 'certificates') {
      const item = row as BusinessCertificate;
      setForm({ image_url: item.image_url || '', name: item.name, issuing_organization: item.issuing_organization || '', year: item.year?.toString() || '' });
    } else if (activeTab === 'clients') {
      const item = row as BusinessClient;
      setForm({ name: item.name, logo_url: item.logo_url || '', description: item.description || '' });
    } else if (activeTab === 'testimonials') {
      const item = row as BusinessTestimonial;
      setForm({ customer_name: item.customer_name, testimonial_text: item.testimonial_text, rating: item.rating.toString(), avatar_url: item.avatar_url || '' });
    } else {
      const item = row as BusinessStatistic;
      setForm({ stat_value: item.stat_value, stat_label: item.stat_label, icon: item.icon || 'award' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this item from your card?')) return;
    const { error } = await supabase.from(tableByTab[activeTab]).delete().eq('id', id);
    if (error) showToast('Could not remove this item.');
    else {
      setRows(previous => previous.filter(row => row.id !== id));
      showToast('Item removed.');
    }
  };

  const toggle = async (row: ShowcaseRow) => {
    const { error } = await supabase.from(tableByTab[activeTab]).update({ is_enabled: !row.is_enabled }).eq('id', row.id);
    if (error) showToast('Could not change visibility.');
    else setRows(previous => previous.map(item => item.id === row.id ? { ...item, is_enabled: !item.is_enabled } : item));
  };

  const move = async (row: ShowcaseRow, direction: -1 | 1) => {
    const index = rows.findIndex(item => item.id === row.id);
    const target = rows[index + direction];
    if (!target) return;
    await Promise.all([
      supabase.from(tableByTab[activeTab]).update({ sort_order: target.sort_order }).eq('id', row.id),
      supabase.from(tableByTab[activeTab]).update({ sort_order: row.sort_order }).eq('id', target.id),
    ]);
    await loadRows(activeTab);
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForms[activeTab]); };

  return (
    <div className="showcase-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Showcase</h1>
          <p className="page-subtitle">Turn your SmartCard into a polished mini website that helps customers trust and contact you.</p>
        </div>
        <div className="showcase-live-note"><Check size={15} /> Changes appear on your card</div>
      </div>

      <div className="showcase-tabs">
        {tabItems.map(item => {
          const Icon = item.icon;
          return <button key={item.key} className={activeTab === item.key ? 'active' : ''} onClick={() => setActiveTab(item.key)}><Icon size={17} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>;
        })}
      </div>

      <div className="showcase-layout">
        <form className="panel showcase-editor" onSubmit={save}>
          <div className="showcase-panel-heading"><div><h2>{editingId ? `Edit ${activeItem.label.toLowerCase().slice(0, -1)}` : `Add ${activeItem.label.replace('Trusted By', 'client')}`}</h2><p>Only enabled items are shown to visitors.</p></div>{editingId && <button type="button" className="icon-close" onClick={cancelEdit}><X size={17} /></button>}</div>
          {activeTab === 'services' && <ServiceFields form={form as ServiceForm} update={updateForm} uploading={uploading} upload={handleUpload} />}
          {activeTab === 'gallery' && <GalleryFields form={form as GalleryForm} update={updateForm} uploading={uploading} upload={handleUpload} />}
          {activeTab === 'certificates' && <CertificateFields form={form as CertificateForm} update={updateForm} uploading={uploading} upload={handleUpload} />}
          {activeTab === 'clients' && <ClientFields form={form as ClientForm} update={updateForm} uploading={uploading} upload={handleUpload} />}
          {activeTab === 'testimonials' && <TestimonialFields form={form as TestimonialForm} update={updateForm} uploading={uploading} upload={handleUpload} />}
          {activeTab === 'statistics' && <StatisticFields form={form as StatisticForm} update={updateForm} />}
          <div className="modal-footer showcase-form-footer"><button type="button" className="ghost-btn" onClick={cancelEdit}>Clear</button><button type="submit" className="primary-btn" disabled={saving || uploading}><Save size={15} /> {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add to card'}</button></div>
        </form>

        <div className="showcase-list-wrap">
          <div className="showcase-list-heading"><div><h2>{activeItem.label}</h2><p>{rows.length} {rows.length === 1 ? 'item' : 'items'} on your card</p></div><Plus size={18} /></div>
          {loading ? <div className="showcase-empty">Loading your showcase...</div> : rows.length === 0 ? <div className="showcase-empty"><ImagePlus size={30} /><strong>Your {activeItem.label.toLowerCase()} will appear here</strong><span>Add your first item using the form.</span></div> : <div className="showcase-items">{rows.map((row, index) => <ShowcaseItem key={row.id} row={row} tab={activeTab} index={index} total={rows.length} edit={edit} remove={remove} toggle={toggle} move={move} />)}</div>}
        </div>
      </div>
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

type FieldProps<T> = { form: T; update: (key: string, value: string) => void; uploading: boolean; upload: (file: File, field: 'image_url' | 'logo_url' | 'avatar_url') => void };

function UploadField({ label, value, field, update, uploading, upload }: { label: string; value: string; field: 'image_url' | 'logo_url' | 'avatar_url'; update: (key: string, value: string) => void; uploading: boolean; upload: (file: File, field: 'image_url' | 'logo_url' | 'avatar_url') => void }) {
  return <div className="showcase-upload"><label>{label}</label><div className="showcase-upload-row">{value && <img src={value} alt="Preview" />}{value ? <button type="button" className="ghost-btn" onClick={() => update(field, '')}>Remove</button> : <label className="upload-trigger"><ImagePlus size={16} /> {uploading ? 'Uploading...' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) upload(file, field); }} /></label>}</div><input value={value} onChange={event => update(field, event.target.value)} placeholder="Or paste an image URL" /></div>;
}

function ServiceFields({ form, update, uploading, upload }: FieldProps<ServiceForm>) { return <div className="showcase-fields"><div className="form-field"><label>Service name</label><input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Invisible Grills" /></div><div className="form-field"><label>Description</label><textarea required rows={3} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Explain the value customers get..." /></div><div className="form-row"><div className="form-field"><label>Starting price (optional)</label><input type="number" min="0" value={form.starting_price} onChange={e => update('starting_price', e.target.value)} placeholder="2500" /></div><div className="form-field"><label>Button label</label><input value={form.cta_label} onChange={e => update('cta_label', e.target.value)} placeholder="Get Quote" /></div></div><div className="form-field"><label>Button link (optional)</label><input value={form.cta_link} onChange={e => update('cta_link', e.target.value)} placeholder="https://... or tel:..." /></div><UploadField label="Service image" value={form.image_url} field="image_url" update={update} uploading={uploading} upload={upload} /></div>; }
function GalleryFields({ form, update, uploading, upload }: FieldProps<GalleryForm>) { return <div className="showcase-fields"><UploadField label="Gallery image" value={form.image_url} field="image_url" update={update} uploading={uploading} upload={upload} /><div className="form-field"><label>Title</label><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Balcony safety installation" /></div><div className="form-field"><label>Description (optional)</label><textarea rows={3} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Add context about this project..." /></div></div>; }
function CertificateFields({ form, update, uploading, upload }: FieldProps<CertificateForm>) { return <div className="showcase-fields"><div className="form-field"><label>Certificate name</label><input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. ISO 9001:2015" /></div><div className="form-row"><div className="form-field"><label>Issuing organization</label><input value={form.issuing_organization} onChange={e => update('issuing_organization', e.target.value)} placeholder="e.g. Bureau of Standards" /></div><div className="form-field"><label>Year</label><input type="number" value={form.year} onChange={e => update('year', e.target.value)} placeholder="2024" /></div></div><UploadField label="Certificate image (optional)" value={form.image_url} field="image_url" update={update} uploading={uploading} upload={upload} /></div>; }
function ClientFields({ form, update, uploading, upload }: FieldProps<ClientForm>) { return <div className="showcase-fields"><div className="form-field"><label>Client or company name</label><input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Acme Industries" /></div><UploadField label="Client logo" value={form.logo_url} field="logo_url" update={update} uploading={uploading} upload={upload} /><div className="form-field"><label>Description (optional)</label><input value={form.description} onChange={e => update('description', e.target.value)} placeholder="What you helped them with" /></div></div>; }
function TestimonialFields({ form, update, uploading, upload }: FieldProps<TestimonialForm>) { return <div className="showcase-fields"><div className="form-field"><label>Customer name</label><input required value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="e.g. Rahul Mehta" /></div><div className="form-field"><label>Testimonial</label><textarea required rows={4} value={form.testimonial_text} onChange={e => update('testimonial_text', e.target.value)} placeholder="What did your customer say?" /></div><div className="form-field"><label>Rating</label><select value={form.rating} onChange={e => update('rating', e.target.value)}><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></div><UploadField label="Customer photo (optional)" value={form.avatar_url} field="avatar_url" update={update} uploading={uploading} upload={upload} /></div>; }
function StatisticFields({ form, update }: { form: StatisticForm; update: (key: string, value: string) => void }) { return <div className="showcase-fields"><div className="form-row"><div className="form-field"><label>Value</label><input required value={form.stat_value} onChange={e => update('stat_value', e.target.value)} placeholder="12+" /></div><div className="form-field"><label>Label</label><input required value={form.stat_label} onChange={e => update('stat_label', e.target.value)} placeholder="Years Experience" /></div></div><div className="form-field"><label>Icon style</label><select value={form.icon} onChange={e => update('icon', e.target.value)}><option value="award">Award</option><option value="users">Customers</option><option value="briefcase">Projects</option><option value="star">Rating</option></select></div><p className="showcase-help">Only add numbers you can stand behind. These are displayed exactly as entered.</p></div>; }

function ShowcaseItem({ row, tab, index, total, edit, remove, toggle, move }: { row: ShowcaseRow; tab: ShowcaseTab; index: number; total: number; edit: (row: ShowcaseRow) => void; remove: (id: string) => void; toggle: (row: ShowcaseRow) => void; move: (row: ShowcaseRow, direction: -1 | 1) => void }) {
  const label = tab === 'services' ? (row as BusinessService).name : tab === 'gallery' ? (row as BusinessGalleryItem).title || 'Gallery image' : tab === 'certificates' ? (row as BusinessCertificate).name : tab === 'clients' ? (row as BusinessClient).name : tab === 'testimonials' ? (row as BusinessTestimonial).customer_name : `${(row as BusinessStatistic).stat_value} ${(row as BusinessStatistic).stat_label}`;
  const image = tab === 'services' ? (row as BusinessService).image_url : tab === 'gallery' ? (row as BusinessGalleryItem).image_url : tab === 'certificates' ? (row as BusinessCertificate).image_url : tab === 'clients' ? (row as BusinessClient).logo_url : tab === 'testimonials' ? (row as BusinessTestimonial).avatar_url : null;
  const detail = tab === 'services' ? (row as BusinessService).description : tab === 'testimonials' ? (row as BusinessTestimonial).testimonial_text : tab === 'certificates' ? (row as BusinessCertificate).issuing_organization : tab === 'clients' ? (row as BusinessClient).description : tab === 'gallery' ? (row as BusinessGalleryItem).description : (row as BusinessStatistic).stat_label;
  return <div className={`showcase-item ${!row.is_enabled ? 'disabled' : ''}`}>{image ? <img src={image} alt="" /> : <div className="showcase-item-placeholder"><Award size={18} /></div>}<div className="showcase-item-content"><strong>{label}</strong>{detail && <span>{detail}</span>}<small>{row.is_enabled ? 'Visible on card' : 'Hidden from card'}</small></div><div className="showcase-item-actions"><button type="button" title="Move up" disabled={index === 0} onClick={() => move(row, -1)}><ChevronUp size={15} /></button><button type="button" title="Move down" disabled={index === total - 1} onClick={() => move(row, 1)}><ChevronDown size={15} /></button><button type="button" onClick={() => toggle(row)}>{row.is_enabled ? <Check size={15} /> : <X size={15} />}</button><button type="button" onClick={() => edit(row)}><Save size={15} /></button><button type="button" className="danger" onClick={() => remove(row.id)}><Trash2 size={15} /></button></div></div>;
}
