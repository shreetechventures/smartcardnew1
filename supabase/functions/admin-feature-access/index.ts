const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const email = typeof body.admin_email === "string" ? body.admin_email.trim() : "";
    const passwordHash = typeof body.admin_password_hash === "string" ? body.admin_password_hash : "";
    const action = typeof body.action === "string" ? body.action : "";
    if (!email || !passwordHash) return json({ error: "Unauthorized" }, 401);

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isValid, error: authError } = await supabase.rpc("verify_admin_login", {
      p_email: email,
      p_password_hash: passwordHash,
    });
    if (authError || !isValid) return json({ error: "Unauthorized" }, 401);

    if (action === "upsert_plan_features") {
      const planId = typeof body.plan_id === "string" ? body.plan_id : "";
      const features = body.features && typeof body.features === "object" ? body.features : null;
      if (!planId || !features) return json({ error: "Missing plan_id or features" }, 400);
      const { error } = await supabase.from("plan_feature_access").upsert({
        plan_id: planId,
        features,
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: "Could not update plan features" }, 500);
      return json({ success: true });
    }

    if (action === "upsert_user_override") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      const companyId = typeof body.company_id === "string" ? body.company_id : null;
      const features = body.features && typeof body.features === "object" ? body.features : null;
      if (!userId || !features) return json({ error: "Missing user_id or features" }, 400);
      const { error } = await supabase.from("user_feature_overrides").upsert({
        user_id: userId,
        company_id: companyId,
        features,
        updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: "Could not update user override" }, 500);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch {
    return json({ error: "Request failed" }, 500);
  }
});
