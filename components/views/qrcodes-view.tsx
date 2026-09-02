'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, MoreVertical, Plus, QrCode, Search, Trash2, X } from 'lucide-react';
import { supabase, type Card, type QRCode } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

export function QRCodesView() {
  const { companyId } = useCompanyId();
  const [cards, setCards] = useState<Card[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ card_id: '', label: '', qr_type: 'card' as 'card' | 'review' });
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 2500); };

  const fetchData = async () => {
    setLoading(true);
    const { data: cardsData } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
    setCards(cardsData || []);
    const { data: qrData } = await supabase.from('qr_codes').select('*').order('created_at', { ascending: false });
    setQrCodes((qrData as QRCode[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const cardMap = new Map(cards.map(c => [c.id, c]));

  const filtered = qrCodes.filter(qr => {
    const card = cardMap.get(qr.card_id);
    const name = card?.name || '';
    return qr.label.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
  });

  const totalScans = qrCodes.reduce((s, q) => s + q.scans, 0);

  const getCardUrl = (handle: string, qrType: 'card' | 'review' = 'card') => {
    if (typeof window !== 'undefined') {
      if (qrType === 'review') return `${window.location.origin}/review?handle=${handle}`;
      return `${window.location.origin}/card/${handle}`;
    }
    if (qrType === 'review') return `https://thesmartcard.in/review?handle=${handle}`;
    return `https://thesmartcard.in/card/${handle}`;
  };

  const getQRImageUrl = (handle: string, qrType: 'card' | 'review' = 'card') => {
    const url = getCardUrl(handle, qrType);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  };

  const createQR = async () => {
    if (!form.card_id) { showToast('Please select a card'); return; }
    const card = cardMap.get(form.card_id);
    if (!card) return;
    const { data } = await supabase.from('qr_codes').insert({
      card_id: card.id,
      label: form.label || `${card.name} QR`,
      qr_type: form.qr_type,
      scans: 0,
      company_id: companyId,
    }).select('*').single();
    if (data) setQrCodes(prev => [data as QRCode, ...prev]);
    setShowForm(false);
    setForm({ card_id: '', label: '', qr_type: 'card' });
    showToast('QR code generated successfully');
  };

  const removeQR = async (id: string) => {
    await supabase.from('qr_codes').delete().eq('id', id);
    setQrCodes(prev => prev.filter(q => q.id !== id));
    setMenuOpen(null);
    showToast('QR code deleted');
  };

  const copyLink = (qr: QRCode) => {
    const card = cardMap.get(qr.card_id);
    const link = getCardUrl(card?.handle || '', qr.qr_type);
    navigator.clipboard?.writeText(link);
    setCopiedId(qr.id);
    showToast('Link copied to clipboard');
    window.setTimeout(() => setCopiedId(null), 2500);
  };

  const downloadQR = (qr: QRCode) => {
    const card = cardMap.get(qr.card_id);
    if (!card) return;
    const qrUrl = getQRImageUrl(card.handle, qr.qr_type);
    fetch(qrUrl).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.handle}-qr-code.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('QR code downloaded');
    }).catch(() => showToast('Failed to download QR code'));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">QR Codes</h2>
          <p className="page-subtitle">Generate and manage QR codes linked to your cards</p>
        </div>
        <button className="primary-btn" onClick={() => { setForm({ card_id: '', label: '', qr_type: 'card' }); setShowForm(true); }}><Plus size={17} /> Generate QR Code</button>
      </div>

      <div className="summary-row">
        <div className="summary-card"><QrCode size={20} /><div><strong>{qrCodes.length}</strong><span>Total QR Codes</span></div></div>
        <div className="summary-card"><Search size={20} /><div><strong>{totalScans.toLocaleString()}</strong><span>Total Scans</span></div></div>
        <div className="summary-card"><Download size={20} /><div><strong>{qrCodes.length}</strong><span>Downloadable</span></div></div>
        <div className="summary-card"><Copy size={20} /><div><strong>{cards.length}</strong><span>Linked Cards</span></div></div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search QR codes by label or card name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toolbar-info">{filtered.length} QR code{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {loading ? (
        <div className="empty-state">Loading QR codes...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <QrCode size={48} />
          <h3>No QR codes found</h3>
          <p>{search ? 'Try a different search.' : 'Generate your first QR code to get started.'}</p>
          {!search && <button className="primary-btn" onClick={() => { setForm({ card_id: '', label: '', qr_type: 'card' }); setShowForm(true); }}><Plus size={17} /> Generate QR Code</button>}
        </div>
      ) : (
        <div className="qr-grid">
          {filtered.map(qr => {
            const card = cardMap.get(qr.card_id);
            return (
              <div className="qr-card" key={qr.id}>
                <div className="qr-visual">
                  <div className="qr-pattern">
                    {card ? (
                      <img src={getQRImageUrl(card.handle, qr.qr_type)} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <QrCode size={64} />
                    )}
                  </div>
                </div>
                <div className="qr-info">
                  <strong>{qr.label}</strong>
                  <span className="qr-card-name">{card?.name || 'Unknown card'} · {qr.qr_type === 'review' ? 'Review QR' : 'Card QR'}</span>
                  <div className="qr-stats">
                    <span className="qr-scans">{qr.scans} scans</span>
                    <span className="qr-date">{new Date(qr.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                <div className="qr-actions">
                  <button className="qr-action-btn" onClick={() => copyLink(qr)} aria-label="Copy link">
                    {copiedId === qr.id ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <button className="qr-action-btn" onClick={() => downloadQR(qr)} aria-label="Download QR">
                    <Download size={16} />
                  </button>
                  <div className="card-item-menu">
                    <button onClick={() => setMenuOpen(menuOpen === qr.id ? null : qr.id)} aria-label="QR menu"><MoreVertical size={18} /></button>
                    {menuOpen === qr.id && (
                      <div className="menu-dropdown">
                        <button onClick={() => copyLink(qr)}><Copy size={14} /> Copy Link</button>
                        <button onClick={() => downloadQR(qr)}><Download size={14} /> Download</button>
                        <button onClick={() => removeQR(qr.id)} className="danger"><Trash2 size={14} /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate QR Code</h3>
              <button onClick={() => setShowForm(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Link to Card *</label>
                <select value={form.card_id} onChange={e => setForm({ ...form, card_id: e.target.value })}>
                  <option value="">Select a card...</option>
                  {cards.map(card => (
                    <option key={card.id} value={card.id}>{card.name} — @{card.handle}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>QR Label</label>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Conference QR" />
              </div>
              <div className="form-field">
                <label>QR Type</label>
                <select value={form.qr_type} onChange={e => setForm({ ...form, qr_type: e.target.value as 'card' | 'review' })}>
                  <option value="card">Business Card (shows card profile)</option>
                  <option value="review">Review (shows review page)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="ghost-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" onClick={createQR}>Generate</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}
