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
    const { review_id, reviewer_name, rating, comment, business_name, custom_prompt } = await req.json();

    if (!reviewer_name) {
      return new Response(JSON.stringify({ error: "reviewer_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let promptText: string;

    if (custom_prompt) {
      promptText = custom_prompt;
    } else {
      const sentiment = rating >= 4 ? "positive" : rating >= 3 ? "neutral" : "negative";
      promptText = `You are a professional business owner responding to a customer review. Write a warm, professional reply to this review.

Business name: ${business_name || "our business"}
Reviewer: ${reviewer_name}
Rating: ${rating}/5
Review: "${comment || "No comment provided"}"
Sentiment: ${sentiment}

Guidelines:
- Keep it concise (2-3 sentences max)
- Be genuine and warm
- For positive reviews: thank them and invite them back
- For neutral/negative reviews: acknowledge their feedback, apologize if needed, and offer to make it right
- Do not use placeholders or brackets
- Sign off with the business name

Write only the reply text, nothing else.`;
    }

    let replyText = "";

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: textModel,
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          config: {
            temperature: 0.8,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 512,
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
      } catch (err) {
        console.error("[ai-review-reply] Gemini error:", err);
      }
    }

    // Fallback to built-in template generation if Gemini failed
    if (!replyText) {
      const name = business_name || "our business";
      if (custom_prompt && custom_prompt.includes("SEO-friendly Google review")) {
        const r1 = `I had an excellent experience with ${name}. The service was professional and the staff was very helpful. Highly recommend to anyone looking for quality service!`;
        const r2 = `${name} provided outstanding service. Everything was handled professionally and efficiently. I will definitely be coming back and recommending them to friends and family.`;
        const r3 = `Fantastic experience with ${name}! The team is knowledgeable, friendly, and truly cares about customer satisfaction. One of the best service experiences I've had.`;
        replyText = `---\n${r1}\n---\n${r2}\n---\n${r3}`;
      } else {
        if (rating >= 4) {
          replyText = `Thank you so much for your wonderful review! We're thrilled to hear you had a great experience with ${name}. We look forward to serving you again soon. — ${name}`;
        } else if (rating === 3) {
          replyText = `Thank you for your feedback. We appreciate you taking the time to share your experience with ${name}. We're always looking to improve and would love to make it right next time. — ${name}`;
        } else {
          replyText = `We're sorry to hear about your experience and truly appreciate your honest feedback. Please reach out to us directly so we can make things right. We value your patronage. — ${name}`;
        }
      }
    }

    if (!replyText) {
      return new Response(JSON.stringify({ error: "AI generated an empty reply" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to database if this is a real review
    if (review_id && !review_id.startsWith("temp-")) {
      try {
        await supabase.from("reviews")
          .update({ ai_reply: replyText, ai_reply_at: new Date().toISOString() })
          .eq("id", review_id);
      } catch {
        // DB update is best-effort
      }
    }

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-review-reply] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
