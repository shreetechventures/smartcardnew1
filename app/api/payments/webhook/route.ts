import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    const event = body.event;
    const payload = body.payload?.payment_entity;

    if (!event || !payload) {
      return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    // Verify Razorpay webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers.get('x-razorpay-signature');

    if (webhookSecret && signature) {
      const expectedSig = createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSig !== signature) {
        return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const orderId = payload.order_id;
    const paymentId = payload.id;

    if (!orderId) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // Duplicate protection: check if this payment was already processed
    const supabase = getSupabase();
    const { data: existingAttempt } = await supabase
      .from('payment_attempts')
      .select('id, status, gateway_payment_id, invoice_id')
      .eq('gateway_order_id', orderId)
      .maybeSingle();

    if (existingAttempt?.status === 'paid' && existingAttempt?.gateway_payment_id === paymentId) {
      // Already processed — idempotent response
      return Response.json({ received: true, duplicate: true });
    }

    // Handle event types
    if (event === 'payment.captured' || event === 'payment.authorized') {
      const { data, error } = await getSupabase().rpc('mark_payment_paid', {
        p_gateway_order_id: orderId,
        p_gateway_payment_id: paymentId,
      });

      if (error || !data?.success) {
        console.error('mark_payment_paid failed:', error, data);
        return Response.json({ error: 'Failed to update payment' }, { status: 500 });
      }

      return Response.json({ received: true, event, plan_id: data.plan_id });
    }

    if (event === 'payment.failed') {
      const failureReason = payload.error_description || 'Payment failed';
      const { error } = await getSupabase().rpc('mark_payment_failed', {
        p_gateway_order_id: orderId,
        p_failure_reason: failureReason,
      });

      if (error) {
        console.error('mark_payment_failed failed:', error);
        return Response.json({ error: 'Failed to update payment' }, { status: 500 });
      }

      return Response.json({ received: true, event });
    }

    if (event === 'payment.refunded') {
      // Mark the payment attempt and invoice as refunded
      const s = getSupabase();
      await s
        .from('payment_attempts')
        .update({ status: 'refunded' })
        .eq('gateway_order_id', orderId);

      await s
        .from('invoices')
        .update({ status: 'refunded' })
        .eq('id', existingAttempt?.invoice_id)
        .eq('status', 'paid');

      return Response.json({ received: true, event });
    }

    // Unhandled event type — acknowledge receipt
    return Response.json({ received: true, event, unhandled: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: 'ok' });
}
