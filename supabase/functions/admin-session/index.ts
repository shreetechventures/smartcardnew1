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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── LOGIN: verify credentials, create session ──
    if (action === "login") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const passwordHash = typeof body.password_hash === "string" ? body.password_hash : "";
      if (!email || !passwordHash) return json({ error: "Missing credentials" }, 400);

      const { data: isValid, error: authError } = await supabase.rpc("verify_admin_login", {
        p_email: email,
        p_password_hash: passwordHash,
      });
      if (authError || !isValid) return json({ error: "Invalid credentials" }, 401);

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

      const { error: insertError } = await supabase
        .from("admin_sessions")
        .insert({ token, admin_email: email, expires_at: expiresAt });
      if (insertError) return json({ error: "Failed to create session" }, 500);

      return json({ token, expires_at: expiresAt });
    }

    // ── VERIFY: check if a session token is still valid ──
    if (action === "verify") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!token) return json({ valid: false }, 400);

      const { data: isValid, error } = await supabase.rpc("is_valid_admin_session", { p_token: token });
      if (error || !isValid) return json({ valid: false });

      const { data: email } = await supabase.rpc("get_admin_session_email", { p_token: token });
      return json({ valid: true, email });
    }

    // ── LOGOUT: revoke session ──
    if (action === "logout") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!token) return json({ success: true });

      await supabase.rpc("revoke_admin_session", { p_token: token });
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch {
    return json({ error: "Request failed" }, 500);
  }
});
