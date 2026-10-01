import { GoogleGenAI } from "npm:@google/genai@^1";

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
    const {
      company_id,
      rating,
      customer_experience,
      customer_comment,
      business_profile,
      generation_seed,
    } = await req.json();

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rating || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "rating (1-5) is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve Gemini API key + model from platform_secrets or env
    let apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    let textModel = Deno.env.get("GEMINI_TEXT_MODEL") || "gemini-2.0-flash";
    try {
      const { data: secretRows } = await supabase
        .from("platform_secrets")
        .select("key_name, key_value")
        .in("key_name", ["GEMINI_API_KEY", "GEMINI_TEXT_MODEL"]);
      for (const row of secretRows || []) {
        if (row.key_value && row.key_value.trim()) {
          if (row.key_name === "GEMINI_API_KEY") apiKey = row.key_value;
          if (row.key_name === "GEMINI_TEXT_MODEL") textModel = row.key_value;
        }
      }
    } catch { /* fall back to env */ }

    // Build business profile context from the provided profile data
    const bp = business_profile || {};
    const businessName = bp.business_name || "our business";
    const bpParts: string[] = [];
    if (bp.business_name) bpParts.push(`Business Name: ${bp.business_name}`);
    if (bp.about) bpParts.push(`About: ${bp.about}`);
    if (bp.tagline) bpParts.push(`Tagline: ${bp.tagline}`);
    if (bp.address) bpParts.push(`Location: ${bp.address}`);
    if (bp.city) bpParts.push(`City: ${bp.city}`);
    if (bp.state) bpParts.push(`State: ${bp.state}`);
    if (bp.website) bpParts.push(`Website: ${bp.website}`);
    if (bp.phone) bpParts.push(`Phone: ${bp.phone}`);
    const businessContext = bpParts.length > 0 ? bpParts.join("\n") : `Business Name: ${businessName}`;

    // Build customer experience context
    const experienceTags = Array.isArray(customer_experience) ? customer_experience : [];
    const experienceStr = experienceTags.length > 0 ? experienceTags.join(", ") : "";
    const commentStr = customer_comment || "";

    // Rating-aware tone guidance
    let toneGuidance = "";
    if (rating >= 4) {
      toneGuidance = "The tone should be genuinely positive and enthusiastic but natural.";
    } else if (rating === 3) {
      toneGuidance = "The tone should be balanced — mention positives but keep it honest and measured.";
    } else {
      toneGuidance = "The tone should reflect a less-than-perfect experience. Do not fabricate positive experiences. Be honest but constructive.";
    }

    const seed = generation_seed || crypto.randomUUID();

    const prompt = `Generate 3 unique review suggestions for a customer to post about a business.

BUSINESS PROFILE:
${businessContext}

RATING: ${rating} out of 5 stars

CUSTOMER EXPERIENCE: ${experienceStr || "General positive experience"}
CUSTOMER COMMENT: ${commentStr || "None provided"}

UNIQUE GENERATION SEED: ${seed}

Requirements:
- Use only factual information available in the business profile above.
- Do NOT invent services, products, awards, employees, locations, prices, guarantees or results that are not in the profile.
- Do NOT fabricate specific customer experiences that aren't supported by the customer's input.
- Naturally and briefly mention relevant business information (name, location, or services) where it fits — do NOT mechanically list every field.
- Make each of the 3 reviews substantially different in sentence structure, opening, wording, emphasis, and flow.
- Avoid repetitive phrases across the 3 reviews.
- Avoid generic AI language like "I recently had the pleasure of" or "I would highly recommend".
- Make the reviews sound natural and human, as if written by different customers.
- ${toneGuidance}
- Keep each review to 2-4 sentences.
- Do NOT mention AI, hashtags, or add unnecessary emojis.
- Do NOT copy or closely paraphrase these previously generated reviews (if any are provided below).

Write each review on a separate line prefixed with "---". Write only the reviews, nothing else.`;

    // Fetch recent generated reviews for duplicate prevention (last 20 for this company)
    let recentReviews: string[] = [];
    try {
      const { data: recentData } = await supabase
        .from("review_generation_history")
        .select("generated_reviews")
        .eq("company_id", company_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (recentData) {
        for (const row of recentData) {
          if (row.generated_reviews && Array.isArray(row.generated_reviews)) {
            recentReviews.push(...row.generated_reviews);
          }
        }
      }
    } catch { /* non-critical */ }

    // Add recent reviews to prompt if available
    let fullPrompt = prompt;
    if (recentReviews.length > 0) {
      const recentSample = recentReviews.slice(0, 15).map((r, i) => `${i + 1}. ${r}`).join("\n");
      fullPrompt += `\n\nPREVIOUSLY GENERATED REVIEWS (avoid duplicating these):\n${recentSample}`;
    }

    let replyText = "";
    let usedModel = textModel;

    if (apiKey) {
      // Try up to 2 generation attempts for duplicate prevention
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const res = await ai.models.generateContent({
            model: textModel,
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            config: {
              temperature: 0.9 + attempt * 0.05,
              topP: 0.95,
              topK: 50,
              maxOutputTokens: 1024,
            } as any,
          });

          if (res.candidates && res.candidates.length > 0) {
            const parts = res.candidates[0].content?.parts;
            if (parts) {
              for (const part of parts) {
                const text = (part as any).text;
                if (text) replyText += text;
              }
            }
          }
          replyText = replyText.trim();

          // Parse reviews
          const reviews = parseReviews(replyText, businessName, rating);

          // Check for duplicates against recent history
          if (reviews.length >= 3 && !hasDuplicates(reviews, recentReviews)) {
            break;
          }
          // If duplicates found or fewer than 3, retry with different temperature
          if (attempt === 0 && (reviews.length < 3 || hasDuplicates(reviews, recentReviews))) {
            replyText = "";
            continue;
          }
        } catch (err) {
          console.error(`[ai-review-generate] Gemini attempt ${attempt + 1} error:`, err);
        }
      }
    }

    // Parse the final output
    let reviews = parseReviews(replyText, businessName, rating);

    // Fallback if AI failed or produced fewer than 3 reviews
    if (reviews.length < 3) {
      reviews = generateFallbackReviews(businessName, rating, experienceTags, seed);
    }

    // Save to generation history (best-effort, uses service role key)
    try {
      await supabase.from("review_generation_history").insert({
        company_id,
        rating,
        customer_experience: experienceTags,
        customer_comment: commentStr || null,
        generated_reviews: reviews,
        generation_seed: seed,
        ai_provider: "gemini",
        ai_model: usedModel,
      });
    } catch (err) {
      console.error("[ai-review-generate] Failed to save history:", err);
    }

    return new Response(JSON.stringify({
      reviews,
      generation_seed: seed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-review-generate] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate review suggestions" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseReviews(text: string, businessName: string, _rating: number): string[] {
  if (!text) return [];
  const parts = text.split("---").map((r) => r.trim()).filter((r) => r.length > 15);
  return parts.length > 0 ? parts : [];
}

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

function hasDuplicates(reviews: string[], recentReviews: string[]): boolean {
  const normalizedRecent = recentReviews.map(normalize);
  for (const review of reviews) {
    const norm = normalize(review);
    for (const recent of normalizedRecent) {
      // Check exact match or high similarity (one contains the other)
      if (norm === recent) return true;
      if (norm.length > 30 && recent.length > 30) {
        // Check if 80% of words overlap
        const words1 = new Set(norm.split(" "));
        const words2 = new Set(recent.split(" "));
        const intersection = [...words1].filter((w) => words2.has(w)).length;
        const union = new Set([...words1, ...words2]).size;
        if (union > 0 && intersection / union > 0.8) return true;
      }
    }
  }
  return false;
}

function generateFallbackReviews(businessName: string, rating: number, experienceTags: string[], seed: string): string[] {
  const exp = experienceTags.length > 0 ? experienceTags.join(", ") : "";
  const seedNum = parseInt(seed.replace(/[^0-9]/g, "").slice(0, 6) || "0", 10) || Math.floor(Math.random() * 10000);

  if (rating >= 4) {
    const templates = [
      `Great experience with ${businessName}${exp ? ` — especially their ${exp}` : ""}. The team was professional and attentive. I'd recommend them to anyone looking for reliable service.`,
      `I visited ${businessName} recently and was really impressed. Everything was handled smoothly${exp ? `, particularly their ${exp}` : ""}. Will definitely be going back.`,
      `${businessName} stands out for their commitment to customers${exp ? ` and their ${exp}` : ""}. The whole process was straightforward and I'm very satisfied with the outcome.`,
    ];
    // Shuffle using seed for variety
    return shuffleArray(templates, seedNum);
  } else if (rating === 3) {
    return [
      `My experience with ${businessName} was decent. ${exp ? `They did well with ${exp}. ` : ""}There's room for improvement in some areas but overall it was an okay experience.`,
      `${businessName} provided an average experience. ${exp ? `The ${exp} was noticeable. ` : ""}With some refinements they could really elevate their service.`,
      `I had a mixed experience with ${businessName}. ${exp ? `The ${exp} was there but ` : ""}I expected a bit more consistency. They have potential though.`,
    ];
  } else {
    return [
      `My experience with ${businessName} didn't meet expectations. ${exp ? `The ${exp} was lacking. ` : ""}I hope they take this feedback constructively and improve.`,
      `I was disappointed with my visit to ${businessName}. ${exp ? `There were issues with ${exp}. ` : ""}Hopefully they can address these concerns going forward.`,
      `${businessName} has areas that need attention. ${exp ? `The ${exp} fell short. ` : ""}I'd encourage them to focus on improving the customer experience.`,
    ];
  }
}

function shuffleArray<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
