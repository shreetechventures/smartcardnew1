import { GoogleGenAI } from "npm:@google/genai@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SIMILARITY_THRESHOLD = 0.88;
const RESERVATION_MINUTES = 15;
const MAX_GENERATION_ATTEMPTS = 10;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeReview(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TONES = ["casual", "friendly", "enthusiastic", "professional", "warm", "simple and natural", "story-like"];
const ANGLES = [
  "staff behavior", "service speed", "product quality", "cleanliness",
  "value for money", "ambience", "specific product or service",
  "first visit experience", "repeat visit experience", "family experience",
  "customer service", "attention to detail", "overall experience", "recommendation",
];
const STRUCTURES = [
  "short one-paragraph review", "experience-first", "specific-detail-first",
  "recommendation-first", "story-based", "simple conversational review",
];
const OPENINGS_AVOID = [
  "I recently visited", "Great place", "Highly recommend",
  "Had an amazing experience", "Absolutely loved", "One of the best",
];

function buildDiversePrompt(
  businessContext: string,
  rating: number,
  experienceStr: string,
  commentStr: string,
  seed: string,
  recentReviews: string[],
  count: number,
): string {
  const tone = pickRandom(TONES);
  const angle = pickRandom(ANGLES);
  const structure = pickRandom(STRUCTURES);
  const avoidOpenings = OPENINGS_AVOID.slice(0, 3 + Math.floor(Math.random() * 3)).join(", ");

  let toneGuidance = "";
  if (rating >= 4) {
    toneGuidance = "The tone should be genuinely positive but natural — not over-the-top.";
  } else if (rating === 3) {
    toneGuidance = "The tone should be balanced — mention positives but keep it honest and measured.";
  } else {
    toneGuidance = "The tone should reflect a less-than-perfect experience. Be honest but constructive.";
  }

  const prompt = `Generate ${count} unique review suggestions for a customer to post about a business.

BUSINESS PROFILE:
${businessContext}

RATING: ${rating} out of 5 stars
CUSTOMER EXPERIENCE: ${experienceStr || "General experience"}
CUSTOMER COMMENT: ${commentStr || "None provided"}
UNIQUE GENERATION SEED: ${seed}

DIVERSITY DIRECTIVES FOR THIS BATCH:
- Tone: ${tone}
- Review angle: focus on ${angle}
- Structure: ${structure}
- Vary the length naturally (2-4 sentences each, but not all the same length)

Requirements:
- Use only factual information from the business profile above.
- Do NOT invent services, products, awards, locations, or results not in the profile.
- Make each review substantially different in wording, structure, and perspective.
- Avoid repetitive openings like: ${avoidOpenings}
- Avoid generic AI language like "I recently had the pleasure of" or "I would highly recommend".
- ${toneGuidance}
- Do NOT mention AI, hashtags, or add emojis.
- Do NOT copy or closely paraphrase any previously generated reviews listed below.

Write each review on a separate line prefixed with "---". Write only the reviews, nothing else.`;

  let fullPrompt = prompt;
  if (recentReviews.length > 0) {
    const sample = recentReviews.slice(0, 20).map((r, i) => `${i + 1}. ${r}`).join("\n");
    fullPrompt += `\n\nPREVIOUSLY GENERATED REVIEWS (do NOT duplicate or closely paraphrase these):\n${sample}`;
  }
  return fullPrompt;
}

function parseReviews(text: string): string[] {
  if (!text) return [];
  const parts = text
    .split("---")
    .map((r) => r.trim())
    .filter((r) => r.length > 15);
  // Deduplicate within the same batch by normalized text
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const norm = normalizeReview(part);
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(part);
    }
  }
  return unique;
}

async function generateWithGemini(
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature,
      topP: 0.95,
      topK: 50,
      maxOutputTokens: 2048,
    } as any,
  });

  let replyText = "";
  if (res.candidates && res.candidates.length > 0) {
    const parts = res.candidates[0].content?.parts;
    if (parts) {
      for (const part of parts) {
        const text = (part as any).text;
        if (text) replyText += text;
      }
    }
  }
  return replyText.trim();
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
      session_id,
    } = await req.json();

    if (!company_id) return json({ error: "company_id is required" }, 400);
    if (!rating || rating < 1 || rating > 5) return json({ error: "rating (1-5) is required" }, 400);

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve Gemini API key + model
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

    // Build business context
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

    const experienceTags = Array.isArray(customer_experience) ? customer_experience : [];
    const experienceStr = experienceTags.length > 0 ? experienceTags.join(", ") : "";
    const commentStr = customer_comment || "";

    // Fetch ALL existing review content for this company for dedup
    // This includes available, reserved, and used reviews
    const { data: existingReviews } = await supabase
      .from("ai_review_candidates")
      .select("content, content_hash")
      .eq("company_id", company_id);

    const existingContents = (existingReviews || []).map((r) => r.content);
    const existingHashes = new Set((existingReviews || []).map((r) => r.content_hash));
    const existingNormalized = existingContents.map(normalizeReview);

    console.log(`[ReviewGeneration] company=${company_id} rating=${rating} existing=${existingContents.length} requested=3`);

    // Also fetch from review_generation_history for additional context
    let historyReviews: string[] = [];
    try {
      const { data: recentData } = await supabase
        .from("review_generation_history")
        .select("generated_reviews")
        .eq("company_id", company_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (recentData) {
        for (const row of recentData) {
          if (row.generated_reviews && Array.isArray(row.generated_reviews)) {
            historyReviews.push(...row.generated_reviews);
          }
        }
      }
    } catch { /* non-critical */ }

    const allRecentReviews = [...existingContents, ...historyReviews];
    const seed = crypto.randomUUID();
    const reservedBy = session_id || crypto.randomUUID();
    const accepted: { content: string; hash: string }[] = [];
    let totalAttempts = 0;

    // Generate reviews in a loop until we have 3 accepted or hit max attempts
    while (accepted.length < 3 && totalAttempts < MAX_GENERATION_ATTEMPTS) {
      totalAttempts++;
      console.log(`[ReviewGeneration] attempt=${totalAttempts} accepted=${accepted.length}`);

      const countNeeded = 3 - accepted.length;
      const prompt = buildDiversePrompt(
        businessContext,
        rating,
        experienceStr,
        commentStr,
        `${seed}-${totalAttempts}`,
        allRecentReviews,
        countNeeded,
      );

      let aiText = "";
      if (apiKey) {
        try {
          const temp = 0.85 + (totalAttempts - 1) * 0.03;
          aiText = await generateWithGemini(apiKey, textModel, prompt, Math.min(temp, 1.1));
        } catch (err) {
          console.error(`[ReviewGeneration] Gemini attempt ${totalAttempts} error:`, err);
        }
      }

      let candidates = parseReviews(aiText);

      // If AI failed entirely, use fallback on first attempt only
      if (candidates.length === 0 && totalAttempts === 1 && !apiKey) {
        candidates = generateFallbackReviews(businessName, rating, experienceTags, seed);
      }

      if (candidates.length === 0) {
        continue;
      }

      // Dedup check each candidate
      for (const candidate of candidates) {
        if (accepted.length >= 3) break;

        const normalized = normalizeReview(candidate);
        const hash = await sha256Hash(normalized);

        // 1. Exact hash check against DB
        if (existingHashes.has(hash)) {
          console.log(`[DuplicateCheck] REJECTED exact hash: ${candidate.slice(0, 50)}...`);
          continue;
        }

        // 2. Exact hash check against already-accepted in this batch
        if (accepted.some((a) => a.hash === hash)) {
          console.log(`[DuplicateCheck] REJECTED in-batch duplicate: ${candidate.slice(0, 50)}...`);
          continue;
        }

        // 3. Semantic similarity check (Jaccard) against existing + accepted
        let isSimilar = false;
        const allCompare = [...existingNormalized, ...accepted.map((a) => normalizeReview(a.content))];

        for (const existing of allCompare) {
          if (normalized.length > 20 && existing.length > 20) {
            const sim = jaccardSimilarity(normalized, existing);
            if (sim >= SIMILARITY_THRESHOLD) {
              console.log(`[SimilarityCheck] REJECTED sim=${sim.toFixed(2)}: ${candidate.slice(0, 50)}...`);
              isSimilar = true;
              break;
            }
          }
        }

        if (isSimilar) continue;

        // Accepted!
        console.log(`[Review] Accepted candidate: ${candidate.slice(0, 50)}...`);
        accepted.push({ content: candidate, hash });
        existingHashes.add(hash);
        existingNormalized.push(normalized);
      }
    }

    if (accepted.length === 0) {
      // Use fallback as last resort
      const fallbacks = generateFallbackReviews(businessName, rating, experienceTags, seed);
      for (const fb of fallbacks.slice(0, 3)) {
        const norm = normalizeReview(fb);
        const hash = await sha256Hash(norm);
        if (!existingHashes.has(hash) && !accepted.some((a) => a.hash === hash)) {
          accepted.push({ content: fb, hash });
          existingHashes.add(hash);
        }
      }
    }

    if (accepted.length === 0) {
      return json({
        success: false,
        code: "INSUFFICIENT_UNIQUE_REVIEWS",
        message: "Unable to generate enough unique reviews right now.",
        reviews: [],
      });
    }

    // Insert accepted reviews into ai_review_candidates with status 'available'
    const insertRows = accepted.map((a) => ({
      company_id,
      content: a.content,
      content_hash: a.hash,
      rating,
      status: "available",
      generation_seed: seed,
      ai_model: textModel,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("ai_review_candidates")
      .insert(insertRows)
      .select("id, content, rating");

    if (insertError || !insertedRows || insertedRows.length === 0) {
      console.error("[ReviewGeneration] Failed to insert candidates:", insertError);
      // Return the reviews without IDs as a fallback
      return json({
        reviews: accepted.map((a) => ({ id: null, content: a.content })),
        generation_seed: seed,
      });
    }

    // Reserve the inserted reviews for this user atomically
    const reviewIds = insertedRows.map((r) => r.id);
    const { error: reserveError } = await supabase
      .from("ai_review_candidates")
      .update({
        status: "reserved",
        reserved_by: reservedBy,
        reserved_at: new Date().toISOString(),
      })
      .in("id", reviewIds)
      .eq("status", "available");

    if (reserveError) {
      console.error("[ReviewGeneration] Failed to reserve:", reserveError);
    }

    // Also save to review_generation_history for backward compatibility
    try {
      await supabase.from("review_generation_history").insert({
        company_id,
        rating,
        customer_experience: experienceTags,
        customer_comment: commentStr || null,
        generated_reviews: accepted.map((a) => a.content),
        generation_seed: seed,
        ai_provider: "gemini",
        ai_model: textModel,
      });
    } catch (err) {
      console.error("[ReviewGeneration] Failed to save history:", err);
    }

    const responseReviews = insertedRows.map((r) => ({
      id: r.id,
      content: r.content,
    }));

    console.log(`[ReviewGeneration] Returning ${responseReviews.length} reviews, reserved_by=${reservedBy}`);

    return json({
      reviews: responseReviews,
      generation_seed: seed,
      session_id: reservedBy,
    });
  } catch (err) {
    console.error("[ReviewGeneration] Unhandled error:", err);
    return json({ error: "Failed to generate review suggestions" }, 500);
  }
});
