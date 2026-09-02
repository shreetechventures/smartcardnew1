const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlannerRequest {
  user_prompt: string;
  creative_type?: string;
  occasion_slug?: string;
  business_profile?: {
    business_name?: string;
    tagline?: string;
    about?: string;
    city?: string;
    website?: string;
    phone?: string;
    email?: string;
  };
  brand_kit?: {
    primary_color?: string;
    secondary_color?: string;
    preferred_style?: string;
    preferred_language?: string;
  };
  language?: string;
  aspect_ratio?: string;
}

interface OccasionData {
  name: string;
  slug: string;
  category: string;
  visual_elements: string[];
  negative_elements: string[];
  preferred_colors: string[];
  composition_rules: Record<string, any>;
  prompt_guidelines: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: PlannerRequest = await req.json();
    const {
      user_prompt,
      creative_type,
      occasion_slug,
      business_profile,
      brand_kit,
      language = "en",
      aspect_ratio = "4:5",
    } = body;

    if (!user_prompt) {
      return new Response(JSON.stringify({ error: "User prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // STEP 1: Fetch occasion data from the knowledge base
    // ============================================================
    let occasionData: OccasionData | null = null;

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (occasion_slug) {
      const { data: occ } = await supabase
        .from("creative_occasions")
        .select("*")
        .eq("slug", occasion_slug)
        .eq("is_active", true)
        .maybeSingle();
      if (occ) {
        occasionData = {
          name: occ.name,
          slug: occ.slug,
          category: occ.category,
          visual_elements: occ.visual_elements || [],
          negative_elements: occ.negative_elements || [],
          preferred_colors: occ.preferred_colors || [],
          composition_rules: occ.composition_rules || {},
          prompt_guidelines: occ.prompt_guidelines || "",
        };
      }
    }

    // If no explicit occasion, try to detect from the user prompt
    if (!occasionData) {
      const promptLower = user_prompt.toLowerCase();
      const { data: allOccasions } = await supabase
        .from("creative_occasions")
        .select("name, slug, category, visual_elements, negative_elements, preferred_colors, composition_rules, prompt_guidelines")
        .eq("is_active", true);

      if (allOccasions) {
        for (const occ of allOccasions) {
          const occName = occ.name.toLowerCase();
          const occSlug = occ.slug.toLowerCase();
          if (promptLower.includes(occName) || promptLower.includes(occSlug)) {
            occasionData = {
              name: occ.name,
              slug: occ.slug,
              category: occ.category,
              visual_elements: occ.visual_elements || [],
              negative_elements: occ.negative_elements || [],
              preferred_colors: occ.preferred_colors || [],
              composition_rules: occ.composition_rules || {},
              prompt_guidelines: occ.prompt_guidelines || "",
            };
            break;
          }
        }
      }
    }

    // ============================================================
    // STEP 2: Build the Gemini planner prompt with occasion context
    // ============================================================
    const textModel = "gemini-2.5-flash-preview-05-20";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${apiKey}`;

    const businessContext = business_profile ? `
Business Context:
- Name: ${business_profile.business_name || "N/A"}
- Tagline: ${business_profile.tagline || "N/A"}
- About: ${business_profile.about || "N/A"}
- City: ${business_profile.city || "N/A"}
- Website: ${business_profile.website || "N/A"}
` : "";

    const brandContext = brand_kit ? `
Brand Preferences:
- Primary color: ${brand_kit.primary_color || "#5648db"}
- Secondary color: ${brand_kit.secondary_color || "#0ea5e9"}
- Preferred style: ${brand_kit.preferred_style || "professional"}
- Language: ${brand_kit.preferred_language || language}
` : "";

    const occasionContext = occasionData ? `
Detected Occasion: ${occasionData.name}
Occasion Category: ${occasionData.category}

Visual Elements to Include:
${occasionData.visual_elements.map((e: string) => `- ${e}`).join("\n")}

Elements to Avoid:
${occasionData.negative_elements.map((e: string) => `- ${e}`).join("\n")}

Preferred Color Palette:
${occasionData.preferred_colors.join(", ")}

Composition Rules:
${JSON.stringify(occasionData.composition_rules, null, 2)}

Occasion-Specific Guidelines:
${occasionData.prompt_guidelines}
` : "";

    const creativeTypeContext = creative_type ? `
Creative Type: ${creative_type}
` : "";

    const systemPrompt = `You are an AI Creative Planner for a marketing poster generation system for Indian businesses.
Given a user's request, business context, brand preferences, and occasion knowledge, create a structured creative brief and a highly specific AI image prompt.

${businessContext}
${brandContext}
${occasionContext}
${creativeTypeContext}

CRITICAL RULES FOR THE IMAGE PROMPT:
1. The image_prompt must describe ONLY the visual scene — no text, no logos, no QR codes, no watermarks
2. If an occasion is detected, the image_prompt MUST incorporate the occasion's visual elements
3. The image_prompt MUST explicitly avoid the occasion's negative elements
4. The image_prompt must specify composition: where to leave clean negative space for text overlay
5. The image_prompt must specify lighting, mood, and style
6. The image_prompt must be in English regardless of the copy language
7. The image_prompt should be detailed and specific (50-100 words)
8. Include "professional commercial photography" or "premium digital art" style designation
9. Specify "no text, no watermark, no logo, no letters" at the end of the image prompt

CRITICAL RULES FOR THE COPY:
1. Generate headline, subheadline, offer_text, and cta_text in the specified language
2. Headline should be catchy and max 40 characters
3. Subheadline should support the headline, max 60 characters
4. CTA should be action-oriented (e.g. Visit Now, Shop Today, Call Now, Book Now)
5. If the occasion is a festival greeting, the headline should be a greeting

Respond with ONLY a JSON object (no markdown, no code blocks) in this exact format:
{
  "detected_occasion": "${occasionData?.name || "none"}",
  "creative_brief": {
    "occasion": "occasion name or general",
    "industry": "detected industry from business context",
    "purpose": "festival greeting / product promotion / brand awareness / offer / event",
    "tone": "professional / festive / minimal / luxury / casual",
    "visual_subject": "detailed description of the main visual subject",
    "style": "premium corporate / traditional Indian / minimal / cinematic / vibrant festive",
    "composition": "portrait / landscape / square",
    "aspect_ratio": "${aspect_ratio}",
    "text_space": "where text should go (top / bottom / right / left / center)"
  },
  "image_prompt": "The detailed image generation prompt following all critical rules above",
  "copy": {
    "headline": "catchy headline in the specified language",
    "subheadline": "supporting subheadline in the specified language",
    "offer_text": "offer text if applicable, otherwise empty string",
    "cta_text": "call to action in the specified language"
  },
  "recommended_templates": ["festival", "product", "offer", "review", "event", "branding"],
  "concepts": [
    { "name": "Premium", "style": "luxury", "image_prompt": "alternative prompt with premium luxury styling" },
    { "name": "Traditional", "style": "traditional", "image_prompt": "alternative prompt with traditional Indian styling" },
    { "name": "Minimal", "style": "minimal", "image_prompt": "alternative prompt with minimal clean styling" },
    { "name": "Vibrant", "style": "vibrant", "image_prompt": "alternative prompt with vibrant colorful styling" }
  ]
}

Language for copy: ${language === "hi" ? "Hindi (Devanagari script)" : language === "mr" ? "Marathi (Devanagari script)" : language === "gu" ? "Gujarati" : language === "ta" ? "Tamil" : language === "te" ? "Telugu" : language === "kn" ? "Kannada" : language === "bn" ? "Bengali" : language === "pa" ? "Punjabi (Gurmukhi script)" : "English"}`;

    const geminiBody = {
      contents: [{
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nUser request: ${user_prompt}` }],
      }],
      generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error: ${geminiRes.status} - ${errText}`);
    }

    const geminiData = await geminiRes.json();
    let responseText = "";

    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts) {
      for (const part of geminiData.candidates[0].content.parts) {
        if (part.text) {
          responseText += part.text;
        }
      }
    }

    // Parse the JSON response
    let parsed: any;
    try {
      const cleanJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      // Fallback: build response manually using occasion data
      const fallbackImagePrompt = occasionData
        ? `${occasionData.prompt_guidelines} Visual elements: ${occasionData.visual_elements.join(", ")}. Avoid: ${occasionData.negative_elements.join(", ")}. Composition: leave clean ${occasionData.composition_rules?.negative_space || "top"} space for text. No text, no watermark, no logo, no letters. Professional commercial photography.`
        : `${user_prompt}, professional, high quality, vibrant, no text, no watermark, no logo.`;

      parsed = {
        detected_occasion: occasionData?.name || "none",
        creative_brief: {
          occasion: occasionData?.name || "general",
          industry: business_profile?.about || "business",
          purpose: creative_type || "marketing",
          tone: "professional",
          visual_subject: user_prompt,
          style: brand_kit?.preferred_style || "professional",
          composition: "portrait",
          aspect_ratio,
          text_space: occasionData?.composition_rules?.negative_space || "bottom",
        },
        image_prompt: fallbackImagePrompt,
        copy: {
          headline: business_profile?.business_name || "Your Business",
          subheadline: business_profile?.tagline || "",
          offer_text: "",
          cta_text: "Visit Now",
        },
        recommended_templates: ["festival", "product", "offer"],
        concepts: [],
      };
    }

    // ============================================================
    // STEP 3: Enrich the image prompt with occasion data if detected
    // ============================================================
    if (occasionData && parsed.image_prompt) {
      // Ensure negative elements are in the prompt
      const negStr = occasionData.negative_elements.join(", ");
      if (!parsed.image_prompt.toLowerCase().includes("avoid") && negStr) {
        parsed.image_prompt += `. Avoid: ${negStr}.`;
      }
      // Ensure no-text instruction
      if (!parsed.image_prompt.toLowerCase().includes("no text")) {
        parsed.image_prompt += ". No text, no watermark, no logo, no letters.";
      }
      // Ensure negative space instruction
      const negSpace = occasionData.composition_rules?.negative_space;
      if (negSpace && !parsed.image_prompt.toLowerCase().includes("negative space")) {
        parsed.image_prompt += ` Leave clean ${negSpace} space for text overlay.`;
      }
    }

    // Also enrich concept prompts
    if (occasionData && parsed.concepts) {
      for (const concept of parsed.concepts) {
        if (concept.image_prompt) {
          if (!concept.image_prompt.toLowerCase().includes("no text")) {
            concept.image_prompt += ". No text, no watermark, no logo, no letters.";
          }
          const negStr = occasionData.negative_elements.join(", ");
          if (!concept.image_prompt.toLowerCase().includes("avoid") && negStr) {
            concept.image_prompt += ` Avoid: ${negStr}.`;
          }
        }
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
