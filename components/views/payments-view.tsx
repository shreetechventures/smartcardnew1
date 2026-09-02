'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, CreditCard, Download, Search, TrendingUp, Wallet, RefreshCw, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { plans } from '@/lib/plans';
import { useCompanyId } from '@/hooks/use-company-id';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Invoice = {
  id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'expired';
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

export function PaymentsView() {
  const { companyId } = useCompanyId();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [retryingInvoice, setRetryingInvoice] = useState<string | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast(msg);
    setToastError(isError);
    window.setTimeout(() => { setToast(''); setToastError(false); }, 4000);
  };

  const fetchInvoices = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = invoices.filter(inv => {
    const planName = plans.find(p => p.id === inv.plan_id)?.name || inv.plan_id;
    const matchSearch = planName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const failedCount = invoices.filter(i => i.status === 'failed').length;
  const paidCount = invoices.filter(i => i.status === 'paid').length;

  const retryInvoice = async (invoice: Invoice) => {
    const plan = plans.find(p => p.id === invoice.plan_id);
    if (!plan || !companyId) return;

    setRetryingInvoice(invoice.id);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const orderRes = await fetch(`${supabaseUrl}/functions/v1/razorpay-create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ plan_id: plan.id, plan_name: plan.name, amount: Number(invoice.amount), company_id: companyId, invoice_id: invoice.id }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || 'Could not start retry payment.');
      }

      const order = await orderRes.json();

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'TheSmartCard',
        description: `${plan.name} Plan — Retry Payment`,
        order_id: order.order_id,
        theme: { color: '#5648db' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(`${supabaseUrl}/functions/v1/razorpay-verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) throw new Error('Payment verification failed');

            showToast(`Payment successful! Your ${plan.name} plan is now active.`);
            fetchInvoices();
          } catch (err: any) {
            showToast(err.message || 'Verification failed. Please contact support.', true);
          }
        },
        modal: { ondismiss: () => showToast('Retry payment cancelled.') },
      });

      rzp.on('payment.failed', (resp: any) => {
        showToast(`Payment failed: ${resp?.error?.description || 'Please try again.'}`, true);
      });

      rzp.open();
    } catch (err: any) {
      showToast(err.message || 'Could not retry payment.', true);
    } finally {
      setRetryingInvoice(null);
    }
  };

  const cancelInvoice = async (invoiceId: string) => {
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: invoiceId });
    if (error) {
      showToast('Could not cancel invoice.', true);
      return;
    }
    showToast('Invoice cancelled.');
    fetchInvoices();
  };

  const downloadInvoice = (inv: Invoice) => {
    const invoiceId = `INV-${inv.id.slice(0, 8).toUpperCase()}`;
    const date = new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const amount = `\u20b9${Number(inv.amount).toLocaleString('en-IN')}`;
    const planName = plans.find(p => p.id === inv.plan_id)?.name || inv.plan_id;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoiceId}</title>
<style>
body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#1a1a2e}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #5648db;padding-bottom:20px;margin-bottom:30px}
.logo{font-size:24px;font-weight:bold;color:#5648db}
.invoice-meta{text-align:right;font-size:13px;color:#666}
.invoice-title{font-size:22px;font-weight:bold;margin:20px 0 10px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{text-align:left;padding:10px;background:#f8f9fc;border-bottom:2px solid #e3e6ec;font-size:12px;text-transform:uppercase;color:#666}
td{padding:12px 10px;border-bottom:1px solid #e3e6ec;font-size:14px}
.total-row{font-weight:bold;font-size:16px;background:#f8f9fc}
.status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;text-transform:uppercase}
.status-paid{background:#dcfce7;color:#16a34a}
.status-pending{background:#fef9c3;color:#ca8a04}
.status-failed{background:#fee2e2;color:#dc2626}
.status-cancelled{background:#f1f5f9;color:#64748b}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e3e6ec;font-size:12px;color:#888;text-align:center}
</style></head><body>
<div class="header">
<div class="logo">TheSmartCard</div>
<div class="invoice-meta"><div>Invoice: ${invoiceId}</div><div>Date: ${date}</div></div>
</div>
<div class="invoice-title">Subscription Invoice</div>
<table>
<thead><tr><th>Description</th><th>Plan</th><th>Amount</th></tr></thead>
<tbody>
<tr><td>${planName} Plan Subscription (1 year)</td><td>${planName}</td><td>${amount}</td></tr>
<tr class="total-row"><td colspan="2">Total</td><td>${amount}</td></tr>
</tbody>
</table>
<p><strong>Payment Status:</strong> <span class="status-badge status-${inv.status}">${inv.status}</span></p>
<div class="footer">This is a computer-generated invoice from TheSmartCard.<br>For queries, contact support@thesmartcard.com</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Payments</h2>
          <p className="page-subtitle">View your billing history, retry failed payments, and download invoices</p>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-card"><Wallet size={20} /><div><strong>{`\u20b9${totalPaid.toLocaleString('en-IN')}`}</strong><span>Total Paid</span></div></div>
        <div className="summary-card"><Check size={20} /><div><strong>{paidCount}</strong><span>Successful</span></div></div>
        <div className="summary-card"><Clock size={20} /><div><strong>{`\u20b9${pendingAmount.toLocaleString('en-IN')}`}</strong><span>Pending</span></div></div>
        <div className="summary-card"><AlertCircle size={20} /><div><strong>{failedCount}</strong><span>Failed</span></div></div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search by plan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          {['all', 'paid', 'pending', 'failed', 'cancelled'].map(s => (
            <button key={s} className={statusFilter === s ? 'filter-active' : ''} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading payments...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={48} />
          <h3>No payments found</h3>
          <p>{search || statusFilter !== 'all' ? 'Try a different search or filter.' : 'Your billing history will appear here once you make a payment.'}</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const planName = plans.find(p => p.id === inv.plan_id)?.name || inv.plan_id;
                return (
                  <tr key={inv.id}>
                    <td className="muted">{new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><strong>{planName}</strong></td>
                    <td className="pay-amount">{`\u20b9${Number(inv.amount).toLocaleString('en-IN')}`}</td>
                    <td><span className={`pay-status pay-${inv.status}`}><span className="dot" />{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="ghost-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => downloadInvoice(inv)}><Download size={13} /> Invoice</button>
                        {(inv.status === 'failed' || inv.status === 'pending') && (
                          <button className="primary-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => retryInvoice(inv)} disabled={retryingInvoice === inv.id}>
                            {retryingInvoice === inv.id ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Retry
                          </button>
                        )}
                        {inv.status === 'pending' && (
                          <button className="ghost-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => cancelInvoice(inv.id)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className={`toast ${toastError ? 'toast-error' : ''}`}>
          {toastError ? <AlertCircle size={17} /> : <Check size={17} />} {toast}
        </div>
      )}
    </>
  );
}
