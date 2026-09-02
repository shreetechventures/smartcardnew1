'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, CreditCard, Download, Loader2, Sparkles, RefreshCw, AlertCircle, Clock } from 'lucide-react';
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

type CompanyInfo = {
  plan_id: string;
  subscription_status: string;
  subscription_expires_at: string | null;
};

export function SubscriptionView() {
  const { companyId } = useCompanyId();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [retryingInvoice, setRetryingInvoice] = useState<string | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast(msg);
    setToastError(isError);
    window.setTimeout(() => { setToast(''); setToastError(false); }, 4000);
  };

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [invRes, compRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(10),
      supabase.from('companies').select('plan_id, subscription_status, subscription_expires_at').eq('id', companyId).maybeSingle(),
    ]);
    setInvoices((invRes.data as Invoice[]) || []);
    setCompany(compRes.data as CompanyInfo);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startCheckout = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (plan.price === 0) {
      showToast('You are on the free Starter plan.');
      return;
    }

    if (!companyId) {
      showToast('Unable to identify your company. Please refresh and try again.', true);
      return;
    }

    setProcessingPlan(planId);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const orderRes = await fetch(`${supabaseUrl}/functions/v1/razorpay-create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ plan_id: plan.id, plan_name: plan.name, amount: plan.price, company_id: companyId }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || 'Could not start payment. Please try again.');
      }

      const order = await orderRes.json();

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'TheSmartCard',
        description: `${plan.name} Plan Subscription`,
        order_id: order.order_id,
        notes: { plan_id: plan.id, plan_name: plan.name },
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

            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({}));
              throw new Error(err.error || 'Payment verification failed');
            }

            showToast(`Payment successful! You are now on the ${plan.name} plan.`);
            fetchData();
          } catch (err: any) {
            showToast(err.message || 'Payment verification failed. Please contact support.', true);
          }
        },
        modal: {
          ondismiss: () => {
            showToast('Payment was cancelled.');
          },
        },
      });

      rzp.on('payment.failed', (resp: any) => {
        showToast(`Payment failed: ${resp?.error?.description || 'Please try again.'}`, true);
      });

      rzp.open();
    } catch (err: any) {
      showToast(err.message || 'Payment failed. Please try again.', true);
    } finally {
      setProcessingPlan(null);
    }
  };

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

            if (!verifyRes.ok) {
              throw new Error('Payment verification failed');
            }

            showToast(`Payment successful! Your ${plan.name} plan is now active.`);
            fetchData();
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
      showToast(err.message || 'Could not retry payment. Please try again.', true);
    } finally {
      setRetryingInvoice(null);
    }
  };

  const cancelInvoice = async (invoiceId: string) => {
    const { error } = await supabase.rpc('cancel_invoice', { p_invoice_id: invoiceId });
    if (error) {
      showToast('Could not cancel invoice. Please try again.', true);
      return;
    }
    showToast('Invoice cancelled.');
    fetchData();
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

  const currentPlanId = company?.plan_id || 'starter';
  const currentPlanData = plans.find(p => p.id === currentPlanId);
  const subStatus = company?.subscription_status || 'trial';
  const expiresAt = company?.subscription_expires_at;
  const failedInvoices = invoices.filter(i => i.status === 'failed');

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Subscription</h2>
          <p className="page-subtitle">Manage your plan and billing preferences</p>
        </div>
      </div>

      {failedInvoices.length > 0 && (
        <div className="billing-alert">
          <AlertCircle size={18} />
          <div>
            <strong>Payment action required</strong>
            <span>You have {failedInvoices.length} failed payment{failedInvoices.length > 1 ? 's' : ''}. Retry now to activate your plan.</span>
          </div>
        </div>
      )}

      <div className="subscription-current">
        <div className="sub-current-info">
          <div className="sub-current-icon"><Sparkles size={24} /></div>
          <div>
            <span className="sub-current-label">Current Plan</span>
            <strong>{currentPlanData?.name}</strong>
            <span className="sub-current-price">{currentPlanData?.price === 0 ? 'Free' : `\u20b9${currentPlanData?.price.toLocaleString('en-IN')}/year`}</span>
          </div>
        </div>
        <div className="sub-current-meta">
          <div>
            <span>Renewal Date</span>
            <strong>{expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</strong>
          </div>
          <div>
            <span>Payment Method</span>
            <strong><CreditCard size={14} /> Razorpay</strong>
          </div>
          <div>
            <span>Status</span>
            <strong className={subStatus === 'active' ? 'sub-active' : subStatus === 'trial' ? '' : 'sub-active'}>{subStatus.charAt(0).toUpperCase() + subStatus.slice(1)}</strong>
          </div>
        </div>
      </div>

      <div className="plans-grid plans-grid-4">
        {plans.map(plan => (
          <div className={`plan-card ${plan.highlight ? 'plan-highlight' : ''} ${currentPlanId === plan.id ? 'plan-current' : ''}`} key={plan.id}>
            {plan.badge && <span className="plan-badge">{plan.badge}</span>}
            <h3>{plan.name}</h3>
            <div className="plan-price">
              <strong>{plan.price === 0 ? '\u20b90' : `\u20b9${plan.price.toLocaleString('en-IN')}`}</strong>
              <span>/{plan.period}</span>
            </div>
            {plan.originalPrice && plan.originalPrice > plan.price && (
              <div className="plan-original-price"><s>{`\u20b9${plan.originalPrice.toLocaleString('en-IN')}`}</s>/{plan.period}</div>
            )}
            {plan.trialNote && <div className="plan-trial-note">{plan.trialNote}</div>}
            <ul className="plan-features">
              {plan.features.map((f, i) => (
                <li key={i}><Check size={15} /> {f}</li>
              ))}
            </ul>
            <button
              className={currentPlanId === plan.id ? 'ghost-btn' : 'primary-btn'}
              onClick={() => startCheckout(plan.id)}
              disabled={currentPlanId === plan.id || processingPlan !== null || retryingInvoice !== null}
            >
              {processingPlan === plan.id ? (
                <><Loader2 size={15} className="spin" /> Processing...</>
              ) : currentPlanId === plan.id ? (
                'Current Plan'
              ) : plan.price === 0 ? (
                'Downgrade'
              ) : (
                'Upgrade'
              )}
            </button>
          </div>
        ))}
      </div>

      <section className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-heading"><h2>Billing History</h2></div>
        {loading ? (
          <div className="muted" style={{ padding: '20px 0', textAlign: 'center', fontSize: 13 }}>Loading billing history...</div>
        ) : invoices.length === 0 ? (
          <div className="muted" style={{ padding: '20px 0', textAlign: 'center', fontSize: 13 }}>No billing history yet. Upgrade to a paid plan to get started.</div>
        ) : (
          <div className="data-table" style={{ border: '0', boxShadow: 'none' }}>
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
                {invoices.map(inv => {
                  const planName = plans.find(p => p.id === inv.plan_id)?.name || inv.plan_id;
                  return (
                    <tr key={inv.id}>
                      <td className="muted">{new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td><strong>{planName}</strong></td>
                      <td>{`\u20b9${Number(inv.amount).toLocaleString('en-IN')}`}</td>
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
      </section>

      {toast && (
        <div className={`toast ${toastError ? 'toast-error' : ''}`}>
          {toastError ? <AlertCircle size={17} /> : <Check size={17} />} {toast}
        </div>
      )}
    </>
  );
}
