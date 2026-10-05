import { GoogleGenAI } from "npm:@google/genai@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SIMILARITY_THRESHOLD = 0.88;
const MAX_GENERATION_ATTEMPTS = 8;
const RECENT_REVIEWS_FOR_PROMPT = 20;
const RECENT_REVIEWS_FOR_DEDUP = 200;

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
- Avoid generic AI language like "I recently had the pleasure of" or "I would highly recommend".
- ${toneGuidance}
- Do NOT mention AI, hashtags, or add emojis.
- Do NOT copy or closely paraphrase any previously generated reviews listed below.

Write each review on a separate line prefixed with "---". Write only the reviews, nothing else.`;

  let fullPrompt = prompt;
  if (recentReviews.length > 0) {
    const sample = recentReviews.slice(0, RECENT_REVIEWS_FOR_PROMPT).map((r, i) => `${i + 1}. ${r}`).join("\n");
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

// ── Combinatorial fallback system ──
// Produces a large number of unique review combinations so that
// even without an AI API key, the system can generate many unique reviews.

const FB_OPENINGS = [
  "I had a wonderful experience at", "My visit to", "I'm really glad I chose",
  "From the moment I walked into", "If you're looking for reliable service,",
  "I can't say enough good things about", "What a pleasant surprise at",
  "I've been to", "Highly recommend", "Just had a fantastic time at",
  "The team at", "My family and I visited", "On my recent trip to",
  "I was referred to", "After hearing great things, I tried",
  "What stood out most about", "I appreciated how", "The whole experience at",
  "From start to finish,", "Every aspect of my interaction with",
];

const FB_MIDDLES_POS = [
  "was professional and attentive to every detail",
  "handled everything smoothly and efficiently",
  "went above and beyond what I expected",
  "made the entire process stress-free",
  "showed genuine care for customer satisfaction",
  "delivered exactly what was promised",
  "took the time to understand my needs",
  "provided clear guidance throughout",
  "responded quickly to all my questions",
  "maintained a high standard of quality",
  "made me feel valued as a customer",
  "exceeded my expectations in every way",
  "demonstrated real expertise in their field",
  "paid attention to the small things that matter",
  "created a welcoming and comfortable atmosphere",
];

const FB_MIDDLES_NEUTRAL = [
  "provided decent service overall",
  "met most of my expectations",
  "did a reasonable job with the task",
  "was adequate but left room for improvement",
  "handled the basics well enough",
  "was okay but nothing exceptional",
  "got the job done despite some hiccups",
  "had its moments of good service",
];

const FB_MIDDLES_NEGATIVE = [
  "fell short of what I was hoping for",
  "left me feeling underwhelmed",
  "didn't quite meet the standard I expected",
  "had some issues that need addressing",
  "could benefit from more attention to detail",
  "was not as smooth as it should have been",
];

const FB_EXPERIENCE_PHRASES: Record<string, string> = {
  "Professional service": "The professional service was noteworthy",
  "Quick response": "Their quick response time really impressed me",
  "Good quality": "The quality of work was solid",
  "Helpful staff": "The staff were genuinely helpful",
  "Friendly service": "Everyone was friendly and approachable",
  "Fast service": "Service was fast without cutting corners",
  "Good communication": "Communication was clear and timely",
  "Value for money": "Great value for the price I paid",
  "Clean environment": "The place was clean and well-maintained",
  "Knowledgeable team": "The team clearly knew what they were doing",
};

const FB_CLOSINGS_POS = [
  "I'd definitely recommend them to friends and family.",
  "Will be returning for sure.",
  "Five stars from me without hesitation.",
  "Couldn't have asked for a better experience.",
  "This is now my go-to place for sure.",
  "I'm already planning my next visit.",
  "Trust me, you won't be disappointed.",
  "They've earned a loyal customer.",
  "Worth every penny and then some.",
  "I left feeling completely satisfied.",
  "Don't hesitate to give them a try.",
  "Hands down one of the best experiences I've had.",
  "I can see why people recommend them so highly.",
  "Looking forward to working with them again.",
  "They set the bar high for others in this space.",
];

const FB_CLOSINGS_NEUTRAL = [
  "Overall an okay experience with some room to grow.",
  "I'd give them another chance to improve.",
  "Not bad, but I've had better.",
  "With a few tweaks this could be really great.",
  "I hope they take this as constructive feedback.",
  "They have potential and I wish them well.",
  "Middle of the road experience for me.",
  "It was fine for what I needed at the time.",
];

const FB_CLOSINGS_NEG = [
  "I hope they take this feedback seriously and improve.",
  "Unfortunately, I wouldn't rush back.",
  "There's definitely work to be done here.",
  "I'd encourage them to focus on the customer experience.",
  "Hopefully my next visit will be better.",
  "They need to step up their game.",
];

const FB_GENERIC_CLOSINGS = [
  "Great job overall!",
  "Really appreciate the effort.",
  "Thanks to the whole team.",
  "Keep up the good work.",
  "Solid experience from start to finish.",
];

function generateCombinatorialFallback(
  businessName: string,
  rating: number,
  experienceTags: string[],
  seed: string,
  existingNormalized: Set<string>,
  existingHashes: Set<string>,
  count: number,
): string[] {
  const results: string[] = [];
  const seedNum = parseInt(seed.replace(/[^0-9]/g, "").slice(0, 8) || "0", 10) || Math.floor(Math.random() * 100000);

  let s = seedNum;
  function rand(max: number): number {
    s = (s * 9301 + 49297) % 233280;
    return Math.floor((s / 233280) * max);
  }

  const middles = rating >= 4 ? FB_MIDDLES_POS : rating === 3 ? FB_MIDDLES_NEUTRAL : FB_MIDDLES_NEG;
  const closings = rating >= 4 ? FB_CLOSINGS_POS : rating === 3 ? FB_CLOSINGS_NEUTRAL : FB_CLOSINGS_NEG;
  const allClosings = [...closings, ...FB_GENERIC_CLOSINGS];
  const expPhrases = experienceTags.length > 0
    ? experienceTags.map(t => FB_EXPERIENCE_PHRASES[t]).filter(Boolean)
    : [];

  const maxAttempts = count * 50;
  let attempts = 0;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    const opening = FB_OPENINGS[rand(FB_OPENINGS.length)];
    const middle = middles[rand(middles.length)];
    const closing = allClosings[rand(allClosings.length)];
    const useExp = expPhrases.length > 0 && rand(3) > 0;
    const expPhrase = useExp ? expPhrases[rand(expPhrases.length)] : null;

    let review: string;
    if (expPhrase) {
      review = `${opening} ${businessName}. ${expPhrase}. The team ${middle}. ${closing}`;
    } else {
      review = `${opening} ${businessName}. The team ${middle}. ${closing}`;
    }

    const norm = normalizeReview(review);
    if (norm.length < 20) continue;

    // Quick check against existing without hash (saves crypto for viable candidates)
    if (existingNormalized.has(norm)) continue;

    results.push(review);
  }

  return results;
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

    // ── Resolve Gemini API key + model ──
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

    const hasApiKey = apiKey && apiKey.trim().length > 0;

    // ── Build business context ──
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

    // ── Scalable dedup strategy ──
    // 1. Fetch only content_hash of ALL reviews (lightweight, for exact-hash dedup)
    // 2. Fetch content (text) of only the most recent RECENT_REVIEWS_FOR_DEDUP reviews
    //    plus ALL used reviews, for similarity comparison
    // This avoids loading 10,000+ full text strings into memory on every request

    const { data: allHashes } = await supabase
      .from("ai_review_candidates")
      .select("content_hash")
      .eq("company_id", company_id);

    const existingHashes = new Set((allHashes || []).map((r) => r.content_hash));

    // Fetch recent reviews + used reviews for similarity check
    const { data: recentRows } = await supabase
      .from("ai_review_candidates")
      .select("content, status")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .limit(RECENT_REVIEWS_FOR_DEDUP);

    // Also fetch used reviews that might not be in the recent set
    const { data: usedRows } = await supabase
      .from("ai_review_candidates")
      .select("content")
      .eq("company_id", company_id)
      .eq("status", "used")
      .limit(RECENT_REVIEWS_FOR_DEDUP);

    // Combine and deduplicate the content sets for similarity comparison
    const recentContents = (recentRows || []).map((r) => r.content);
    const usedContents = (usedRows || []).map((r) => r.content);
    const similaritySet = new Set([...recentContents, ...usedContents]);
    const existingNormalized = [...similaritySet].map(normalizeReview);
    const existingNormalizedSet = new Set(existingNormalized);

    // For the AI prompt, use a bounded sample of recent review texts
    const promptContextReviews = recentContents.slice(0, RECENT_REVIEWS_FOR_PROMPT);

    console.log(`[ReviewGen] company=${company_id} rating=${rating} totalHashes=${existingHashes.size} similaritySet=${similaritySet.size} hasAPI=${hasApiKey}`);

    const seed = crypto.randomUUID();
    const reservedBy = session_id || crypto.randomUUID();
    const accepted: { content: string; hash: string }[] = [];
    let totalAttempts = 0;

    // ── Generation loop ──
    while (accepted.length < 3 && totalAttempts < MAX_GENERATION_ATTEMPTS) {
      totalAttempts++;
      const countNeeded = 3 - accepted.length;

      let candidates: string[] = [];

      if (hasApiKey) {
        // ── AI generation path ──
        const prompt = buildDiversePrompt(
          businessContext,
          rating,
          experienceStr,
          commentStr,
          `${seed}-${totalAttempts}`,
          promptContextReviews,
          countNeeded,
        );

        try {
          const temp = 0.85 + (totalAttempts - 1) * 0.03;
          const aiText = await generateWithGemini(apiKey, textModel, prompt, Math.min(temp, 1.1));
          candidates = parseReviews(aiText);
        } catch (err) {
          console.error(`[ReviewGen] Gemini attempt ${totalAttempts} error:`, err);
        }

        // If AI returned fewer than needed, supplement with combinatorial fallback
        if (candidates.length < countNeeded) {
          const fbCount = countNeeded - candidates.length;
          const fbReviews = generateCombinatorialFallback(
            businessName, rating, experienceTags, `${seed}-fb-${totalAttempts}`,
            existingNormalizedSet, existingHashes, fbCount,
          );
          candidates = [...candidates, ...fbReviews];
        }
      } else {
        // ── Fallback-only path (no API key) ──
        candidates = generateCombinatorialFallback(
          businessName, rating, experienceTags, `${seed}-fb-${totalAttempts}`,
          existingNormalizedSet, existingHashes, countNeeded,
        );
      }

      if (candidates.length === 0) continue;

      // ── Dedup check each candidate ──
      for (const candidate of candidates) {
        if (accepted.length >= 3) break;

        const normalized = normalizeReview(candidate);
        const hash = await sha256Hash(normalized);

        // 1. Exact hash check against ALL existing reviews (includes used)
        if (existingHashes.has(hash)) {
          console.log(`[Dedup] REJECTED exact hash: ${candidate.slice(0, 50)}...`);
          continue;
        }

        // 2. Exact hash check against already-accepted in this batch
        if (accepted.some((a) => a.hash === hash)) {
          console.log(`[Dedup] REJECTED in-batch duplicate: ${candidate.slice(0, 50)}...`);
          continue;
        }

        // 3. Normalized text quick check (catches punctuation-only variants)
        if (existingNormalizedSet.has(normalized)) {
          console.log(`[Dedup] REJECTED normalized match: ${candidate.slice(0, 50)}...`);
          continue;
        }

        // 4. Semantic similarity check (Jaccard) against recent + used + accepted
        let isSimilar = false;
        const allCompare = [...existingNormalized, ...accepted.map((a) => normalizeReview(a.content))];

        for (const existing of allCompare) {
          if (normalized.length > 20 && existing.length > 20) {
            const sim = jaccardSimilarity(normalized, existing);
            if (sim >= SIMILARITY_THRESHOLD) {
              console.log(`[Dedup] REJECTED sim=${sim.toFixed(2)}: ${candidate.slice(0, 50)}...`);
              isSimilar = true;
              break;
            }
          }
        }

        if (isSimilar) continue;

        // Accepted!
        console.log(`[Dedup] Accepted: ${candidate.slice(0, 50)}...`);
        accepted.push({ content: candidate, hash });
        existingHashes.add(hash);
        existingNormalized.push(normalized);
        existingNormalizedSet.add(normalized);
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

    // ── Insert accepted reviews ──
    const insertRows = accepted.map((a) => ({
      company_id,
      content: a.content,
      content_hash: a.hash,
      rating,
      status: "available",
      generation_seed: seed,
      ai_model: hasApiKey ? textModel : "fallback-combinatorial",
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("ai_review_candidates")
      .insert(insertRows)
      .select("id, content, rating");

    if (insertError || !insertedRows || insertedRows.length === 0) {
      console.error("[ReviewGen] Insert failed:", insertError);
      return json({
        reviews: accepted.map((a) => ({ id: null, content: a.content })),
        generation_seed: seed,
      });
    }

    // ── Reserve the inserted reviews atomically ──
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
      console.error("[ReviewGen] Reserve failed:", reserveError);
    }

    // ── Save to generation history ──
    try {
      await supabase.from("review_generation_history").insert({
        company_id,
        rating,
        customer_experience: experienceTags,
        customer_comment: commentStr || null,
        generated_reviews: accepted.map((a) => a.content),
        generation_seed: seed,
        ai_provider: hasApiKey ? "gemini" : "fallback",
        ai_model: hasApiKey ? textModel : "fallback-combinatorial",
      });
    } catch (err) {
      console.error("[ReviewGen] History save failed:", err);
    }

    const responseReviews = insertedRows.map((r) => ({
      id: r.id,
      content: r.content,
    }));

    console.log(`[ReviewGen] Returning ${responseReviews.length} reviews, reserved_by=${reservedBy}`);

    return json({
      reviews: responseReviews,
      generation_seed: seed,
      session_id: reservedBy,
    });
  } catch (err) {
    console.error("[ReviewGen] Unhandled error:", err);
    return json({ error: "Failed to generate review suggestions" }, 500);
  }
});
