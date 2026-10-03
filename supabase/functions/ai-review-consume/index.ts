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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── CONSUME: mark a reserved review as permanently USED ──
    if (action === "consume") {
      const reviewId = typeof body.review_id === "string" ? body.review_id : "";
      const usedBy = typeof body.session_id === "string" ? body.session_id : null;
      if (!reviewId) return json({ error: "review_id is required" }, 400);

      // Verify the review is reserved and belongs to this user
      const { data: review } = await supabase
        .from("ai_review_candidates")
        .select("id, status, reserved_by")
        .eq("id", reviewId)
        .maybeSingle();

      if (!review) {
        return json({ error: "Review not found" }, 404);
      }

      if (review.status === "used") {
        return json({ error: "Review already consumed" }, 409);
      }

      if (review.status !== "reserved") {
        return json({ error: "Review is no longer available" }, 409);
      }

      // If session_id provided, verify ownership
      if (usedBy && review.reserved_by && review.reserved_by !== usedBy) {
        return json({ error: "Review is no longer available" }, 403);
      }

      // Atomically consume: reserved → used
      const { data: consumed, error } = await supabase
        .from("ai_review_candidates")
        .update({
          status: "used",
          used_by: review.reserved_by || usedBy,
          used_at: new Date().toISOString(),
          reserved_by: null,
          reserved_at: null,
        })
        .eq("id", reviewId)
        .eq("status", "reserved")
        .select("id")
        .maybeSingle();

      if (error || !consumed) {
        return json({ error: "Review is no longer available" }, 409);
      }

      console.log(`[Review] Consumed: ${reviewId} by ${review.reserved_by || usedBy}`);
      return json({ success: true, review_id: reviewId });
    }

    // ── RELEASE: release a user's reservations (without consuming) ──
    if (action === "release") {
      const sessionId = typeof body.session_id === "string" ? body.session_id : "";
      if (!sessionId) return json({ success: true });

      await supabase
        .from("ai_review_candidates")
        .update({
          status: "available",
          reserved_by: null,
          reserved_at: null,
        })
        .eq("reserved_by", sessionId)
        .eq("status", "reserved");

      return json({ success: true });
    }

    // ── VERIFY: check if a review is still usable ──
    if (action === "verify") {
      const reviewId = typeof body.review_id === "string" ? body.review_id : "";
      if (!reviewId) return json({ error: "review_id is required" }, 400);

      const { data: review } = await supabase
        .from("ai_review_candidates")
        .select("status, reserved_by")
        .eq("id", reviewId)
        .maybeSingle();

      if (!review) return json({ valid: false, status: "not_found" });
      return json({ valid: review.status === "reserved", status: review.status });
    }

    return json({ error: "Invalid action" }, 400);
  } catch {
    return json({ error: "Request failed" }, 500);
  }
});
