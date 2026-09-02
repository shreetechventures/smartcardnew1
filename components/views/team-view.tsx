'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Crown, Link2, Mail, MessageCircle, MoreVertical, Plus, Search, Send, Trash2, UserPlus, Users, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';
import { useAuth } from '@/lib/auth-context';

type CompanyMember = {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
  profile?: { full_name: string } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  token: string;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

const roleColors: Record<string, string> = {
  owner: 'role-owner',
  admin: 'role-admin',
  editor: 'role-editor',
  viewer: 'role-viewer',
};

const statusColors: Record<string, string> = {
  active: 'member-active',
  invited: 'member-invited',
  suspended: 'member-suspended',
};

export function TeamView() {
  const { companyId } = useCompanyId();
  const { user } = useAuth();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'editor' as 'admin' | 'editor' | 'viewer', phone: '' });
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string, isError = false) => {
    setToast(msg);
    setToastError(isError);
    window.setTimeout(() => { setToast(''); setToastError(false); }, 3000);
  };

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('company_members')
        .select('id, user_id, role, status, created_at, profiles!company_members_user_id_fkey(full_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      supabase
        .from('invitations')
        .select('id, email, role, status, token, created_at')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    setMembers((membersRes.data as CompanyMember[]) || []);
    setInvitations((invitesRes.data as Invitation[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const allRows = [
    ...members.map(m => ({
      id: m.id,
      name: m.profile?.full_name || 'Unknown',
      email: '',
      role: m.role,
      status: m.status,
      joinedAt: m.created_at,
      isInvitation: false,
    })),
    ...invitations.map(inv => ({
      id: inv.id,
      name: inv.email,
      email: inv.email,
      role: inv.role,
      status: 'invited' as const,
      joinedAt: inv.created_at,
      isInvitation: true,
    })),
  ];

  const filtered = allRows.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || r.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: allRows.length,
    active: members.filter(m => m.status === 'active').length,
    invited: invitations.length,
    admins: members.filter(m => m.role === 'owner' || m.role === 'admin').length,
  };

  const getInviteUrl = (token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://thesmartcard.in';
    return `${base}/auth?invite=${token}`;
  };

  const getInviteMessage = (inviteUrl: string, inviterName: string, companyName: string) => {
    return `Hi! ${inviterName} has invited you to join ${companyName} on TheSmartCard. Click here to accept: ${inviteUrl}`;
  };

  const sendInvitation = async () => {
    if (!form.email || !companyId) {
      showToast('Email is required', true);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: companyData } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle();

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const inviterName = profileData?.full_name || user.email || 'Someone';
    const companyName = companyData?.name || 'our team';

    const { data, error } = await supabase.from('invitations').insert({
      company_id: companyId,
      invited_by: user.id,
      email: form.email,
      role: form.role,
      status: 'pending',
    }).select('id, email, role, status, token, created_at').single();

    if (error) {
      if (error.code === '23505') {
        showToast('This email has already been invited', true);
      } else {
        showToast('Could not send invitation. Please try again.', true);
      }
      return;
    }

    const inviteUrl = getInviteUrl(data.token);
    const message = getInviteMessage(inviteUrl, inviterName, companyName);

    // Build shareable links for WhatsApp and Email
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const emailSubject = `Join ${companyName} on TheSmartCard`;
    const emailBody = message;
    const mailtoUrl = `mailto:${form.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    setShowForm(false);
    setForm({ email: '', role: 'editor', phone: '' });
    fetchData();

    // Show the share modal with all options
    setShareLink(JSON.stringify({ url: inviteUrl, whatsapp: whatsappUrl, email: mailtoUrl, message, rawEmail: form.email }));
  };

  const copyInviteLink = (inv: Invitation) => {
    const url = getInviteUrl(inv.token);
    navigator.clipboard?.writeText(url);
    showToast('Invitation link copied!');
  };

  const shareViaWhatsApp = (inv: Invitation) => {
    const url = getInviteUrl(inv.token);
    const message = getInviteMessage(url, user?.email || 'Someone', 'our team');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    setMenuOpen(null);
  };

  const shareViaEmail = (inv: Invitation) => {
    const url = getInviteUrl(inv.token);
    const message = getInviteMessage(url, user?.email || 'Someone', 'our team');
    window.open(`mailto:${inv.email}?subject=${encodeURIComponent('Join our team on TheSmartCard')}&body=${encodeURIComponent(message)}`, '_blank');
    setMenuOpen(null);
  };

  const cancelInvitation = async (id: string) => {
    await supabase.from('invitations').delete().eq('id', id);
    setMenuOpen(null);
    fetchData();
    showToast('Invitation cancelled');
  };

  const changeRole = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    const { error } = await supabase.rpc('set_member_role', { p_member_id: memberId, p_role: newRole });
    if (error) {
      showToast('Could not change role. You may not have permission.', true);
      return;
    }
    setMenuOpen(null);
    fetchData();
    showToast('Role updated');
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.rpc('remove_member', { p_member_id: memberId });
    if (error) {
      showToast('Could not remove member. You may not have permission.', true);
      return;
    }
    setMenuOpen(null);
    fetchData();
    showToast('Member removed');
  };

  const suspendMember = async (memberId: string) => {
    await supabase.from('company_members').update({ status: 'suspended' }).eq('id', memberId);
    setMenuOpen(null);
    fetchData();
    showToast('Member suspended');
  };

  const reactivateMember = async (memberId: string) => {
    await supabase.from('company_members').update({ status: 'active' }).eq('id', memberId);
    setMenuOpen(null);
    fetchData();
    showToast('Member reactivated');
  };

  const shareData = shareLink ? JSON.parse(shareLink) : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Team</h2>
          <p className="page-subtitle">Invite and manage team members collaborating on your company</p>
        </div>
        <button className="primary-btn" onClick={() => { setShowForm(true); setForm({ email: '', role: 'editor', phone: '' }); }}><Plus size={17} /> Invite Member</button>
      </div>

      <div className="summary-row">
        <div className="summary-card"><Users size={20} /><div><strong>{stats.total}</strong><span>Total Members</span></div></div>
        <div className="summary-card"><Check size={20} /><div><strong>{stats.active}</strong><span>Active</span></div></div>
        <div className="summary-card"><UserPlus size={20} /><div><strong>{stats.invited}</strong><span>Invited</span></div></div>
        <div className="summary-card"><Crown size={20} /><div><strong>{stats.admins}</strong><span>Admins</span></div></div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          {['all', 'owner', 'admin', 'editor', 'viewer'].map(r => (
            <button key={r} className={roleFilter === r ? 'filter-active' : ''} onClick={() => setRoleFilter(r)}>
              {r === 'all' ? 'All Roles' : roleLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading team members...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>No members found</h3>
          <p>{search || roleFilter !== 'all' ? 'Try a different search or filter.' : 'Invite your first team member to get started.'}</p>
          {!search && roleFilter === 'all' && <button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={17} /> Invite Member</button>}
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined / Invited</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const inv = invitations.find(i => i.id === r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-name">
                        <div className="cell-avatar">
                          {r.isInvitation ? <Mail size={16} /> : r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong>{r.isInvitation ? r.email : r.name}</strong>
                          {!r.isInvitation && r.email && <span>{r.email}</span>}
                          {r.isInvitation && <span style={{ color: '#94a3b8', fontSize: 11 }}>Pending signup</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className={`member-role ${roleColors[r.role]}`}>{roleLabels[r.role]}</span></td>
                    <td>
                      <span className={`member-status ${statusColors[r.status]}`}>
                        <span className="dot" />{r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                    <td className="muted">
                      {r.isInvitation && <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />}
                      {new Date(r.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      {!r.isInvitation && r.role !== 'owner' && (
                        <div className="row-menu">
                          <button onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)} aria-label="Member menu"><MoreVertical size={18} /></button>
                          {menuOpen === r.id && (
                            <div className="menu-dropdown">
                              {r.role !== 'admin' && <button onClick={() => changeRole(r.id, 'admin')}>Make Admin</button>}
                              {r.role !== 'editor' && <button onClick={() => changeRole(r.id, 'editor')}>Make Editor</button>}
                              {r.role !== 'viewer' && <button onClick={() => changeRole(r.id, 'viewer')}>Make Viewer</button>}
                              {r.status === 'active' && <button onClick={() => suspendMember(r.id)}>Suspend</button>}
                              {r.status === 'suspended' && <button onClick={() => reactivateMember(r.id)}>Reactivate</button>}
                              <button onClick={() => removeMember(r.id)} className="danger"><Trash2 size={14} /> Remove</button>
                            </div>
                          )}
                        </div>
                      )}
                      {r.isInvitation && inv && (
                        <div className="row-menu">
                          <button onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)} aria-label="Invitation menu"><MoreVertical size={18} /></button>
                          {menuOpen === r.id && (
                            <div className="menu-dropdown">
                              <button onClick={() => copyInviteLink(inv)}><Link2 size={14} /> Copy Link</button>
                              <button onClick={() => shareViaWhatsApp(inv)}><MessageCircle size={14} /> Share on WhatsApp</button>
                              <button onClick={() => shareViaEmail(inv)}><Mail size={14} /> Send via Email</button>
                              <button onClick={() => cancelInvitation(r.id)} className="danger"><Trash2 size={14} /> Cancel Invitation</button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invite Team Member</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="colleague@company.com" />
              </div>
              <div className="form-field">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'editor' | 'viewer' })}>
                  <option value="admin">Admin — Full access except billing</option>
                  <option value="editor">Editor — Create and edit cards</option>
                  <option value="viewer">Viewer — Read-only access</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                After creating the invitation, you'll get options to share it via WhatsApp, Email, or copy a direct link.
              </p>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={sendInvitation}><Send size={15} /> Create Invitation</button>
            </div>
          </div>
        </div>
      )}

      {shareData && (
        <div className="modal-overlay" onClick={() => setShareLink(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invitation Created!</h3>
              <button onClick={() => setShareLink(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 20 }}>
                Your invitation has been created. Share it with your team member using any of these options:
              </p>

              <div className="invite-share-options">
                <a href={shareData.whatsapp} target="_blank" rel="noopener noreferrer" className="invite-share-btn whatsapp">
                  <MessageCircle size={22} />
                  <div>
                    <strong>Share via WhatsApp</strong>
                    <span>Opens WhatsApp with the invite message pre-filled</span>
                  </div>
                </a>

                <a href={shareData.email} className="invite-share-btn email">
                  <Mail size={22} />
                  <div>
                    <strong>Send via Email</strong>
                    <span>Opens your email app with the invitation ready to send</span>
                  </div>
                </a>

                <button
                  className="invite-share-btn copy"
                  onClick={() => {
                    navigator.clipboard?.writeText(shareData.url);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={22} /> : <Link2 size={22} />}
                  <div>
                    <strong>{copied ? 'Link Copied!' : 'Copy Direct Link'}</strong>
                    <span style={{ wordBreak: 'break-all', fontSize: 11 }}>{shareData.url}</span>
                  </div>
                </button>
              </div>

              <div className="invite-message-preview">
                <strong>Invite message preview:</strong>
                <p>{shareData.message}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShareLink(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toastError ? 'toast-error' : ''}`}>
          {toastError ? <X size={17} /> : <Check size={17} />} {toast}
        </div>
      )}
    </>
  );
}
