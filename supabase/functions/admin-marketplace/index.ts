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

    if (action === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const category = typeof body.category === "string" ? body.category : "service";
      const description = typeof body.description === "string" ? body.description.trim() : null;
      const creator = typeof body.creator === "string" ? body.creator.trim() : null;
      const price = typeof body.price === "number" && Number.isFinite(body.price) && body.price >= 0 ? body.price : 0;
      const businessName = typeof body.business_name === "string" ? body.business_name.trim() : null;
      const businessLocation = typeof body.business_location === "string" ? body.business_location.trim() : null;
      const businessCategory = typeof body.business_category === "string" ? body.business_category.trim() : null;
      const contactNo = typeof body.contact_no === "string" ? body.contact_no.trim() : null;
      const businessInfo = typeof body.business_info === "string" ? body.business_info.trim() : null;
      if (!title || !["template", "service", "addon", "theme"].includes(category)) return json({ error: "Invalid listing" }, 400);
      const { error } = await supabase.from("marketplace_listings").insert({ title, category, description, price, creator, status: "active", business_name: businessName, business_location: businessLocation, business_category: businessCategory, contact_no: contactNo, business_info: businessInfo });
      if (error) return json({ error: "Could not create listing" }, 500);
      return json({ success: true });
    }

    const listingId = typeof body.listing_id === "string" ? body.listing_id : "";
    if (!listingId) return json({ error: "Invalid listing" }, 400);

    if (action === "toggle") {
      const status = body.status === "active" ? "active" : "inactive";
      const { error } = await supabase.from("marketplace_listings").update({ status }).eq("id", listingId);
      if (error) return json({ error: "Could not update listing" }, 500);
      return json({ success: true });
    }

    if (action === "delete") {
      const { error } = await supabase.from("marketplace_listings").delete().eq("id", listingId);
      if (error) return json({ error: "Could not delete listing" }, 500);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch {
    return json({ error: "Request failed" }, 500);
  }
});
