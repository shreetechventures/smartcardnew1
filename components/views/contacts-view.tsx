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
  Users,
  X,
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
    </>
  );
}
