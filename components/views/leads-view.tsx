'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Filter,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase, type Lead } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type LeadInput = {
  name: string;
  email: string;
  phone: string;
  source: Lead['source'];
  status: Lead['status'];
  notes: string;
};

const emptyLead: LeadInput = { name: '', email: '', phone: '', source: 'manual', status: 'new', notes: '' };

const statusColors: Record<Lead['status'], string> = {
  new: 'status-new',
  contacted: 'status-contacted',
  converted: 'status-converted',
  lost: 'status-lost',
};

const sourceLabels: Record<Lead['source'], string> = {
  qr: 'QR Scan',
  website: 'Website',
  manual: 'Manual',
  referral: 'Referral',
};

export function LeadsView() {
  const { companyId } = useCompanyId();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadInput>(emptyLead);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = leads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || (l.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyLead);
    setShowForm(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({
      name: lead.name, email: lead.email || '', phone: lead.phone || '',
      source: lead.source, status: lead.status, notes: lead.notes || '',
    });
    setShowForm(true);
    setMenuOpen(null);
  };

  const save = async () => {
    if (!form.name) {
      setToast('Name is required');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source,
      status: form.status,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from('leads').update(payload).eq('id', editing.id);
      setToast('Lead updated successfully');
    } else {
      await supabase.from('leads').insert({ ...payload, company_id: companyId });
      setToast('Lead added successfully');
    }
    setShowForm(false);
    setForm(emptyLead);
    setEditing(null);
    fetchLeads();
    window.setTimeout(() => setToast(''), 2500);
  };

  const remove = async (id: string) => {
    await supabase.from('leads').delete().eq('id', id);
    setMenuOpen(null);
    fetchLeads();
    setToast('Lead deleted');
    window.setTimeout(() => setToast(''), 2500);
  };

  const updateStatus = async (id: string, status: Lead['status']) => {
    await supabase.from('leads').update({ status }).eq('id', id);
    fetchLeads();
    setMenuOpen(null);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Leads</h2>
          <p className="page-subtitle">Capture and track leads from your cards and QR scans</p>
        </div>
        <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Add Lead</button>
      </div>

      <div className="summary-row">
        <div className="summary-card"><UserPlus size={20} /><div><strong>{stats.total}</strong><span>Total Leads</span></div></div>
        <div className="summary-card"><div className="dot-new" /><div><strong>{stats.new}</strong><span>New</span></div></div>
        <div className="summary-card"><div className="dot-contacted" /><div><strong>{stats.contacted}</strong><span>Contacted</span></div></div>
        <div className="summary-card"><TrendingUp size={20} /><div><strong>{stats.converted}</strong><span>Converted</span></div></div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search leads by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <Filter size={15} />
          {['all', 'new', 'contacted', 'converted', 'lost'].map(s => (
            <button key={s} className={statusFilter === s ? 'filter-active' : ''} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <UserPlus size={48} />
          <h3>No leads found</h3>
          <p>{search || statusFilter !== 'all' ? 'Try a different search or filter.' : 'Add your first lead to get started.'}</p>
          {!search && statusFilter === 'all' && <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Add Lead</button>}
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Source</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id}>
                  <td><strong>{lead.name}</strong></td>
                  <td><span className="source-badge">{sourceLabels[lead.source]}</span></td>
                  <td>{lead.phone || '—'}</td>
                  <td>{lead.email || '—'}</td>
                  <td>
                    <span className={`lead-status ${statusColors[lead.status]}`}>
                      <span className="dot" />{lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                    </span>
                  </td>
                  <td className="muted">{new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td>
                    <div className="row-menu">
                      <button onClick={() => setMenuOpen(menuOpen === lead.id ? null : lead.id)} aria-label="Lead menu"><MoreVertical size={18} /></button>
                      {menuOpen === lead.id && (
                        <div className="menu-dropdown">
                          <button onClick={() => openEdit(lead)}><Pencil size={14} /> Edit</button>
                          <button onClick={() => updateStatus(lead.id, 'contacted')}>Mark Contacted</button>
                          <button onClick={() => updateStatus(lead.id, 'converted')}>Mark Converted</button>
                          <button onClick={() => remove(lead.id)} className="danger"><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Lead' : 'Add Lead'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Full Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vikram Rao" />
                </div>
                <div className="form-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 91234 56780" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vikram@brightapp.co" />
                </div>
                <div className="form-field">
                  <label>Source</label>
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as Lead['source'] })}>
                    <option value="manual">Manual</option>
                    <option value="qr">QR Scan</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Lead['status'] })}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this lead..." rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={save}>{editing ? 'Save Changes' : 'Add Lead'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
