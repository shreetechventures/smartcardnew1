'use client';

import { useEffect, useState } from 'react';
import { Check, Filter, MoreVertical, Pencil, Plus, Search, Trash2, TrendingUp, UserPlus, X, PhoneCall, Clock } from 'lucide-react';
import { supabase, type CallbackRequest, type Lead } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type LeadInput = { name: string; email: string; phone: string; source: Lead['source']; status: Lead['status']; notes: string };
const emptyLead: LeadInput = { name: '', email: '', phone: '', source: 'manual', status: 'new', notes: '' };
const statusColors: Record<Lead['status'], string> = { new: 'status-new', contacted: 'status-contacted', converted: 'status-converted', lost: 'status-lost' };
const sourceLabels: Record<Lead['source'], string> = { qr: 'QR Scan', website: 'Website', manual: 'Manual', referral: 'Referral' };

export function LeadsView() {
  const { companyId } = useCompanyId();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadInput>(emptyLead);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [leadsRes, callbackRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('callback_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setLeads((leadsRes.data as Lead[]) || []);
    setCallbacks((callbackRes.data as CallbackRequest[]) || []);
    setLoading(false);
  };
  useEffect(() => { void fetchData(); }, []);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500); };
  const filtered = leads.filter(l => { const q = search.toLowerCase(); return (l.name.toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q)) && (statusFilter === 'all' || l.status === statusFilter); });
  const stats = { total: leads.length, new: leads.filter(l => l.status === 'new').length, contacted: leads.filter(l => l.status === 'contacted').length, converted: leads.filter(l => l.status === 'converted').length };
  const openCreate = () => { setEditing(null); setForm(emptyLead); setShowForm(true); };
  const openEdit = (lead: Lead) => { setEditing(lead); setForm({ name: lead.name, email: lead.email || '', phone: lead.phone || '', source: lead.source, status: lead.status, notes: lead.notes || '' }); setShowForm(true); setMenuOpen(null); };
  const save = async () => {
    if (!form.name) { notify('Name is required'); return; }
    const payload = { name: form.name, email: form.email || null, phone: form.phone || null, source: form.source, status: form.status, notes: form.notes || null };
    const result = editing ? await supabase.from('leads').update(payload).eq('id', editing.id) : await supabase.from('leads').insert({ ...payload, company_id: companyId });
    if (result.error) notify('Could not save this lead.'); else { setShowForm(false); setForm(emptyLead); setEditing(null); notify(editing ? 'Lead updated successfully' : 'Lead added successfully'); await fetchData(); }
  };
  const remove = async (id: string) => { const { error } = await supabase.from('leads').delete().eq('id', id); setMenuOpen(null); if (error) notify('Could not delete this lead.'); else { notify('Lead deleted'); await fetchData(); } };
  const updateStatus = async (id: string, status: Lead['status']) => { const { error } = await supabase.from('leads').update({ status }).eq('id', id); setMenuOpen(null); if (!error) await fetchData(); };
  const updateCallbackStatus = async (id: string, status: CallbackRequest['status']) => { const { error } = await supabase.from('callback_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id); if (!error) { setCallbacks(previous => previous.map(item => item.id === id ? { ...item, status } : item)); notify('Callback status updated'); } else notify('Could not update callback.'); };

  return <>
    <div className="page-header"><div><h2 className="page-title">Leads & enquiries</h2><p className="page-subtitle">Capture and follow up with people who discover your business.</p></div><button className="primary-btn" onClick={openCreate}><Plus size={17} /> Add Lead</button></div>
    <div className="summary-row"><div className="summary-card"><UserPlus size={20} /><div><strong>{stats.total}</strong><span>Total Leads</span></div></div><div className="summary-card"><div className="dot-new" /><div><strong>{stats.new}</strong><span>New</span></div></div><div className="summary-card"><div className="dot-contacted" /><div><strong>{stats.contacted}</strong><span>Contacted</span></div></div><div className="summary-card"><TrendingUp size={20} /><div><strong>{stats.converted}</strong><span>Converted</span></div></div></div>
    <div className="toolbar"><div className="search-box"><Search size={16} /><input placeholder="Search leads by name or email..." value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filter-group"><Filter size={15} />{['all', 'new', 'contacted', 'converted', 'lost'].map(s => <button key={s} className={statusFilter === s ? 'filter-active' : ''} onClick={() => setStatusFilter(s)}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>)}</div></div>
    {loading ? <div className="empty-state">Loading enquiries...</div> : filtered.length === 0 ? <div className="empty-state"><UserPlus size={48} /><h3>No leads found</h3><p>{search || statusFilter !== 'all' ? 'Try a different search or filter.' : 'Add your first lead to get started.'}</p>{!search && statusFilter === 'all' && <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Add Lead</button>}</div> : <div className="data-table"><table><thead><tr><th>Name</th><th>Source</th><th>Phone</th><th>Email</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>{filtered.map(lead => <tr key={lead.id}><td><strong>{lead.name}</strong></td><td><span className="source-badge">{sourceLabels[lead.source]}</span></td><td>{lead.phone || '—'}</td><td>{lead.email || '—'}</td><td><span className={`lead-status ${statusColors[lead.status]}`}><span className="dot" />{lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}</span></td><td className="muted">{new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td><td><div className="row-menu"><button onClick={() => setMenuOpen(menuOpen === lead.id ? null : lead.id)} aria-label="Lead menu"><MoreVertical size={18} /></button>{menuOpen === lead.id && <div className="menu-dropdown"><button onClick={() => openEdit(lead)}><Pencil size={14} /> Edit</button><button onClick={() => updateStatus(lead.id, 'contacted')}>Mark Contacted</button><button onClick={() => updateStatus(lead.id, 'converted')}>Mark Converted</button><button onClick={() => remove(lead.id)} className="danger"><Trash2 size={14} /> Delete</button></div>}</div></td></tr>)}</tbody></table></div>}

    <section className="callback-panel"><div className="callback-panel-heading"><div><h2><PhoneCall size={17} /> Callback requests</h2><p>People who asked you to call them back from your SmartCard.</p></div><span>{callbacks.filter(item => item.status === 'pending').length} pending</span></div>{callbacks.length === 0 ? <div className="callback-empty"><Clock size={22} /><span>Callback requests will appear here.</span></div> : <div className="callback-list">{callbacks.map(item => <div className="callback-row" key={item.id}><div className="callback-person"><div className="cell-avatar">{item.customer_name.slice(0, 2).toUpperCase()}</div><div><strong>{item.customer_name}</strong><span>{item.customer_phone}</span></div></div><div><strong>{item.preferred_time || 'Any time'}</strong><small>{item.message || 'No message added'}</small></div><select value={item.status} onChange={e => updateCallbackStatus(item.id, e.target.value as CallbackRequest['status'])}><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="completed">Completed</option></select><time>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></div>)}</div>}</section>

    {showForm && <div className="modal-overlay" onClick={() => setShowForm(false)}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{editing ? 'Edit Lead' : 'Add Lead'}</h3><button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button></div><div className="modal-body"><div className="form-row"><div className="form-field"><label>Full Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vikram Rao" /></div><div className="form-field"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 91234 56780" /></div></div><div className="form-row"><div className="form-field"><label>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vikram@brightapp.co" /></div><div className="form-field"><label>Source</label><select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as Lead['source'] })}><option value="manual">Manual</option><option value="qr">QR Scan</option><option value="website">Website</option><option value="referral">Referral</option></select></div></div><div className="form-field"><label>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Lead['status'] })}><option value="new">New</option><option value="contacted">Contacted</option><option value="converted">Converted</option><option value="lost">Lost</option></select></div><div className="form-field"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this lead..." rows={3} /></div></div><div className="modal-footer"><button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-btn" onClick={save}>{editing ? 'Save Changes' : 'Add Lead'}</button></div></div></div>}
    {toast && <div className="toast"><Check size={17} /> {toast}</div>}
  </>;
}
