'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { supabase, type Contact } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type ContactInput = {
  name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  tags: string;
  notes: string;
};

const emptyContact: ContactInput = { name: '', email: '', phone: '', company: '', job_title: '', tags: '', notes: '' };

export function ContactsView() {
  const { companyId } = useCompanyId();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactInput>(emptyContact);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<{ name: string; email: string; phone: string; company: string; job_title: string; tags: string }[]>([]);
  const [importing, setImporting] = useState(false);

  const parseCSV = (text: string) => {
    const lines = text.split(/\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: typeof importData = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
      rows.push({
        name: row.name || row['full name'] || row['first name'] || '',
        email: row.email || row['e-mail'] || '',
        phone: row.phone || row['mobile'] || row['contact'] || '',
        company: row.company || row['organization'] || '',
        job_title: row['job title'] || row.title || row.designation || '',
        tags: row.tags || row.tag || '',
      });
    }
    return rows.filter(r => r.name);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
 if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setImportData(parsed);
      if (parsed.length === 0) { setToast('No valid contacts found in CSV'); window.setTimeout(() => setToast(''), 2500); }
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    if (importData.length === 0 || !companyId) return;
    setImporting(true);
    const payload = importData.map(r => ({
      name: r.name,
      email: r.email || null,
      phone: r.phone || null,
      company: r.company || null,
      job_title: r.job_title || null,
      tags: r.tags ? r.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
      company_id: companyId,
    }));
    const { error } = await supabase.from('contacts').insert(payload);
    setImporting(false);
    if (error) { setToast('Import failed: ' + error.message); window.setTimeout(() => setToast(''), 3000); return; }
    setToast(`${payload.length} contacts imported successfully`);
    setShowImport(false);
    setImportData([]);
    fetchContacts();
    window.setTimeout(() => setToast(''), 2500);
  };

  const fetchContacts = async () => {
    setLoading(true);
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, []);

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyContact);
    setShowForm(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      name: contact.name, email: contact.email || '', phone: contact.phone || '', company: contact.company || '',
      job_title: contact.job_title || '', tags: contact.tags.join(', '), notes: contact.notes || '',
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
      company: form.company || null,
      job_title: form.job_title || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from('contacts').update(payload).eq('id', editing.id);
      setToast('Contact updated successfully');
    } else {
      await supabase.from('contacts').insert({ ...payload, company_id: companyId });
      setToast('Contact added successfully');
    }
    setShowForm(false);
    setForm(emptyContact);
    setEditing(null);
    fetchContacts();
    window.setTimeout(() => setToast(''), 2500);
  };

  const remove = async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id);
    setMenuOpen(null);
    fetchContacts();
    setToast('Contact deleted');
    window.setTimeout(() => setToast(''), 2500);
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Contacts</h2>
          <p className="page-subtitle">People who saved or exchanged cards with you</p>
        </div>
        <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Add Contact</button>
        <button className="ghost-btn" onClick={() => setShowImport(true)}><Upload size={16} /> Import CSV</button>
      </div>

      <div className="summary-row">
        <div className="summary-card"><Users size={20} /><div><strong>{contacts.length}</strong><span>Total Contacts</span></div></div>
        <div className="summary-card"><Tag size={20} /><div><strong>{new Set(contacts.flatMap(c => c.tags)).size}</strong><span>Tags</span></div></div>
        <div className="summary-card"><Mail size={20} /><div><strong>{contacts.filter(c => c.email).length}</strong><span>With Email</span></div></div>
        <div className="summary-card"><Phone size={20} /><div><strong>{contacts.filter(c => c.phone).length}</strong><span>With Phone</span></div></div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search contacts by name, email, company, or tag..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toolbar-info">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {loading ? (
        <div className="empty-state">Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>No contacts found</h3>
          <p>{search ? 'Try a different search.' : 'Add your first contact to get started.'}</p>
          {!search && <button className="primary-btn" onClick={openCreate}><Plus size={17} /> Add Contact</button>}
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => (
                <tr key={contact.id}>
                  <td>
                    <div className="cell-name">
                      <div className="cell-avatar">{initials(contact.name)}</div>
                      <div>
                        <strong>{contact.name}</strong>
                        <span>{contact.job_title || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>{contact.company || '—'}</td>
                  <td>{contact.phone || '—'}</td>
                  <td>{contact.email || '—'}</td>
                  <td>
                    <div className="tag-list">
                      {contact.tags.map(tag => <span className="tag-chip" key={tag}>{tag}</span>)}
                      {contact.tags.length === 0 && <span className="muted">—</span>}
                    </div>
                  </td>
                  <td>
                    <div className="row-menu">
                      <button onClick={() => setMenuOpen(menuOpen === contact.id ? null : contact.id)} aria-label="Contact menu"><MoreVertical size={18} /></button>
                      {menuOpen === contact.id && (
                        <div className="menu-dropdown">
                          <button onClick={() => openEdit(contact)}><Pencil size={14} /> Edit</button>
                          <button onClick={() => remove(contact.id)} className="danger"><Trash2 size={14} /> Delete</button>
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
              <h3>{editing ? 'Edit Contact' : 'Add Contact'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Full Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Sharma" />
                </div>
                <div className="form-field">
                  <label>Job Title</label>
                  <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} placeholder="e.g. Creative Director" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Design Studio" />
                </div>
                <div className="form-field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 99887 76655" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@designstudio.in" />
                </div>
                <div className="form-field">
                  <label>Tags (comma separated)</label>
                  <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="client, hot" />
                </div>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this contact..." rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={save}>{editing ? 'Save Changes' : 'Add Contact'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FileSpreadsheet size={18} /> Import Contacts from CSV</h3>
              <button onClick={() => setShowImport(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="setup-hint" style={{ marginBottom: 16 }}>Upload a CSV file with columns: name, email, phone, company, job title, tags. The first row should be headers.</p>
              {importData.length === 0 ? (
                <label className="upload-btn" style={{ display: 'flex', justifyContent: 'center', padding: '40px', border: '2px dashed #cbd5e1', borderRadius: 12, cursor: 'pointer' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Upload size={32} />
                    <p style={{ marginTop: 8 }}>Click to browse and select a CSV file</p>
                  </div>
                  <input type="file" accept=".csv,text/csv" onChange={handleFileImport} style={{ display: 'none' }} />
                </label>
              ) : (
                <>
                  <p style={{ marginBottom: 10, fontWeight: 600 }}>{importData.length} contacts ready to import</p>
                  <div className="data-table" style={{ maxHeight: 300, overflow: 'auto' }}>
                    <table>
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th></tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 50).map((r, i) => (
                          <tr key={i}><td>{r.name}</td><td>{r.email || '—'}</td><td>{r.phone || '—'}</td><td>{r.company || '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 50 && <p style={{ padding: 8, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>...and {importData.length - 50} more</p>}
                  </div>
                </>
              )}
            </div>
            {importData.length > 0 && (
              <div className="modal-footer">
                <button className="ghost-btn" onClick={() => { setShowImport(false); setImportData([]); }}>Cancel</button>
                <button className="primary-btn" onClick={doImport} disabled={importing}>{importing ? 'Importing...' : `Import ${importData.length} Contacts`}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
