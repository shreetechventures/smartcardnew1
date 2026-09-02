import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { plan_id, plan_name, amount, company_id, invoice_id } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!company_id) {
      return new Response(JSON.stringify({ error: "Company ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const orderPayload = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `plan_${plan_id}_${Date.now()}`,
      notes: { plan_id, plan_name, company_id },
    };

    const auth = btoa(`${keyId}:${keySecret}`);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: `Razorpay error: ${err}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const order = await res.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (invoice_id) {
      // Retry flow: create new payment attempt on existing invoice
      const { data: retryData, error: retryError } = await supabase
        .rpc("retry_payment", {
          p_invoice_id: invoice_id,
          p_gateway_order_id: order.id,
        });

      if (retryError || !retryData?.success) {
        return new Response(JSON.stringify({ error: retryData?.error || "Failed to create retry attempt" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // New purchase: create invoice + first payment attempt
      const { error: createError } = await supabase.rpc("create_invoice_with_attempt", {
        p_company_id: company_id,
        p_plan_id: plan_id,
        p_amount: amount,
        p_gateway_order_id: order.id,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: "Failed to create invoice" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
