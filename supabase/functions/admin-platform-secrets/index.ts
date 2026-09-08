const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const allowedKeys = new Set([
  "GEMINI_API_KEY",
  "GEMINI_IMAGE_MODEL",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
]);

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const adminEmail = typeof body.admin_email === "string" ? body.admin_email.trim() : "";
    const adminPasswordHash = typeof body.admin_password_hash === "string" ? body.admin_password_hash : "";
    const action = body.action === "update" ? "update" : "list";

    if (!adminEmail || !adminPasswordHash) return json({ error: "Unauthorized" }, 401);

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isValid, error: authError } = await supabase.rpc("verify_admin_login", {
      p_email: adminEmail,
      p_password_hash: adminPasswordHash,
    });
    if (authError || !isValid) return json({ error: "Unauthorized" }, 401);

    if (action === "update") {
      const keyName = typeof body.key_name === "string" ? body.key_name : "";
      const keyValue = typeof body.key_value === "string" ? body.key_value : "";
      if (!allowedKeys.has(keyName) || !keyValue.trim()) return json({ error: "Invalid secret" }, 400);

      const { error } = await supabase
        .from("platform_secrets")
        .update({ key_value: keyValue.trim(), updated_at: new Date().toISOString(), updated_by: adminEmail })
        .eq("key_name", keyName);
      if (error) return json({ error: "Failed to save secret" }, 500);
      return json({ success: true, key_name: keyName, masked_value: maskSecret(keyValue.trim()) });
    }

    const { data, error } = await supabase
      .from("platform_secrets")
      .select("key_name, key_value, description, category, is_secret, updated_at")
      .in("key_name", Array.from(allowedKeys));
    if (error) return json({ error: "Failed to load secrets" }, 500);

    return json({
      secrets: (data || []).map(secret => ({
        key_name: secret.key_name,
        description: secret.description,
        category: secret.category,
        is_secret: secret.is_secret,
        has_value: Boolean(secret.key_value),
        masked_value: secret.is_secret ? maskSecret(secret.key_value) : secret.key_value,
        updated_at: secret.updated_at,
      })),
    });
  } catch {
    return json({ error: "Request failed" }, 500);
  }
});
