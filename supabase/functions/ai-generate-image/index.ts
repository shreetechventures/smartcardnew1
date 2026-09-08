import { GoogleGenAI } from "npm:@google/genai@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ImageProvider = "gemini" | "openai";

interface GenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
  aspect_ratio?: string;
  reference_image?: string;
  operation?: "generate" | "edit" | "remove_bg" | "enhance";
  negative_prompt?: string;
  company_id?: string;
  user_id?: string;
  project_id?: string;
  poster_mode?: boolean;
  category_name?: string;
  frame_orientation?: string;
  business_industry?: string;
  brand_color?: string;
  regenerate?: boolean;
  poster_record_id?: string;
  category_id?: string;
  frame_id?: string;
  provider?: ImageProvider;
}

function aspectRatioToDimensions(ar: string): { width: number; height: number } {
  switch (ar) {
    case "1:1": return { width: 1024, height: 1024 };
    case "4:5": return { width: 1024, height: 1280 };
    case "9:16": return { width: 768, height: 1366 };
    case "16:9": return { width: 1366, height: 768 };
    case "3:4": return { width: 1024, height: 1366 };
    default: return { width: 1024, height: 1280 };
  }
}

function orientationToAspectRatio(orientation: string): string {
  switch (orientation) {
    case "square": return "1:1";
    case "story": return "9:16";
    case "landscape": return "16:9";
    default: return "4:5";
  }
}

function buildEnhancedPrompt(
  prompt: string,
  operation: string,
  negativePrompt?: string,
): string {
  const quality =
    "high quality, detailed, professional, sharp focus, vibrant colors, 4k, photorealistic, professional commercial photography";

  let enhanced = prompt;

  switch (operation) {
    case "remove_bg":
      enhanced = `${prompt}, isolated subject on pure white background, product photography, clean cutout, ${quality}`;
      break;
    case "enhance":
      enhanced = `${prompt}, enhanced, ultra detailed, higher resolution, sharper, better lighting, ${quality}`;
      break;
    case "edit":
      enhanced = `${prompt}, ${quality}`;
      break;
    default:
      enhanced = `${prompt}, ${quality}`;
      break;
  }

  if (negativePrompt) {
    enhanced += `. Avoid: ${negativePrompt}.`;
  }

  if (!enhanced.toLowerCase().includes("no text")) {
    enhanced += ". No text, no watermark, no logo, no letters, no words.";
  }

  return enhanced;
}

function buildPosterSystemInstruction(
  categoryName: string,
  industry: string,
  brandColor: string,
  orientation: string,
): string {
  return `You are a professional creative director for social-media poster design. Given a short user idea, a poster category, and a business's industry, expand it into one vivid, detailed, production-ready image-generation prompt. Include: subject, composition, lighting, color mood (bias toward the business's brand color: ${brandColor}), photography or illustration style appropriate for the category, and 'no text, no logos, no watermarks in the image' as a strict instruction. The image aspect ratio should be ${orientation}. Output ONLY the final prompt text, nothing else.`;
}

function buildPosterUserPrompt(
  userPrompt: string,
  categoryName: string,
  industry: string,
  regenerate: boolean,
): string {
  let base = `User idea: "${userPrompt}"\nPoster category: ${categoryName}`;
  if (industry) base += `\nBusiness industry: ${industry}`;
  if (regenerate) {
    const seeds = [
      "dramatic cinematic lighting from a different angle",
      "warm golden hour ambiance with soft bokeh",
      "bold contrasting colors with a modern minimalist composition",
      "overhead flat-lay perspective with elegant props",
      "moody low-key lighting with selective highlights",
      "bright airy outdoor setting with natural sunlight",
    ];
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    base += `\n\nIMPORTANT: Produce a visibly DIFFERENT variation from any previous attempt. Use a distinctly different creative direction: ${seed}. Random creative seed: ${Math.floor(Math.random() * 999999)}.`;
  }
  return base;
}

function formatProviderError(provider: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[ai-generate-image] ${provider} error:`, msg);
  const label = provider === "openai" ? "OpenAI" : "Gemini";
  if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit")) {
    return `${label} API quota exceeded. Please check your ${label} API plan limits and try again later, or switch to the other AI provider.`;
  }
  if (msg.includes("403") || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("billing")) {
    return `${label} API access denied (403). Billing may not be enabled for this API key. Please enable billing in the ${label} console and update the API key in Admin settings.`;
  }
  if (msg.includes("401") || msg.toLowerCase().includes("invalid api key") || msg.toLowerCase().includes("incorrect api key")) {
    return `${label} API key is invalid or not configured. Please check the ${label} API key in Admin settings.`;
  }
  if (msg.includes("404")) {
    return `The configured ${label} image model was not found. Please update the model name in Admin settings.`;
  }
  if (msg.includes("400")) {
    return `${label} rejected the request (400). The prompt may be too long or contain unsupported content. Please try a simpler prompt.`;
  }
  return `${label} could not generate the image: ${msg.slice(0, 200)}`;
}

function isImagenModel(model: string): boolean {
  return model.toLowerCase().startsWith("imagen");
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// ============================================================
// Gemini image generation (Imagen + Gemini 2.5 Flash Image)
// ============================================================

async function generateImageViaImagen(
  ai: GoogleGenAI,
  imageModel: string,
  enhancedPrompt: string,
  aspectRatio: string,
  negativePrompt?: string,
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const aspectMap: Record<string, "IMAGE_ASPECT_RATIO_SQUARE" | "IMAGE_ASPECT_RATIO_PORTRAIT_3_4" | "IMAGE_ASPECT_RATIO_LANDSCAPE_4_3" | "IMAGE_ASPECT_RATIO_PORTRAIT_16_9" | "IMAGE_ASPECT_RATIO_LANDSCAPE_16_9"> = {
    "1:1": "IMAGE_ASPECT_RATIO_SQUARE",
    "3:4": "IMAGE_ASPECT_RATIO_PORTRAIT_3_4",
    "4:3": "IMAGE_ASPECT_RATIO_LANDSCAPE_4_3",
    "9:16": "IMAGE_ASPECT_RATIO_PORTRAIT_16_9",
    "16:9": "IMAGE_ASPECT_RATIO_LANDSCAPE_16_9",
  };
  const aspectRatioEnum = aspectMap[aspectRatio] || "IMAGE_ASPECT_RATIO_PORTRAIT_3_4";

  const config: any = {
    numberOfImages: 1,
    aspectRatio: aspectRatioEnum,
  };
  if (negativePrompt) {
    config.negativePrompt = negativePrompt;
  }

  const res = await ai.models.generateImages({
    model: imageModel,
    prompt: enhancedPrompt,
    config,
  });

  if (res.generatedImages && res.generatedImages.length > 0) {
    const img = res.generatedImages[0];
    const imageBytes = img.image.imageBytes as Uint8Array;
    if (imageBytes && imageBytes.length > 0) {
      const base64 = uint8ArrayToBase64(imageBytes);
      const mimeType = img.image.mimeType || "image/png";
      return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
    }
  }
  return null;
}

async function generateImageViaGemini(
  ai: GoogleGenAI,
  imageModel: string,
  enhancedPrompt: string,
  aspectRatio: string,
  referenceImage?: string,
  operation?: string,
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const dims = aspectRatioToDimensions(aspectRatio);
  const fullPrompt = `${enhancedPrompt}. Image dimensions: approximately ${dims.width}x${dims.height} pixels, aspect ratio ${aspectRatio}.`;

  const parts: any[] = [{ text: fullPrompt }];

  if (
    referenceImage &&
    (operation === "edit" || operation === "remove_bg" || operation === "enhance")
  ) {
    const base64Match = referenceImage.match(/^data:(.+?);base64,(.+)$/);
    if (base64Match) {
      parts.push({
        inlineData: {
          mimeType: base64Match[1],
          data: base64Match[2],
        },
      });
    }
  }

  const res = await ai.models.generateContent({
    model: imageModel,
    contents: [{ role: "user", parts }],
    config: {
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseModalities: ["TEXT", "IMAGE"],
    } as any,
  });

  if (res.candidates && res.candidates.length > 0) {
    const candidate = res.candidates[0];
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        const inlineData = (part as any).inlineData;
        if (inlineData?.data) {
          const mimeType = inlineData.mimeType || "image/png";
          return { dataUrl: `data:${mimeType};base64,${inlineData.data}`, mimeType };
        }
      }
    }
  }
  return null;
}

async function enhancePromptViaGemini(
  ai: GoogleGenAI,
  textModel: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<string> {
  const res = await ai.models.generateContent({
    model: textModel,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
      systemInstruction,
    } as any,
  });

  const text = res.candidates?.[0]?.content?.parts?.[0] as any;
  if (text?.text) return text.text.trim();
  throw new Error("Gemini returned no enhanced prompt");
}

// ============================================================
// OpenAI GPT-Image-2 image generation + GPT-5.6 Luna prompt enhancement
// ============================================================

function aspectRatioToGptImageSize(aspectRatio: string): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  if (aspectRatio === "16:9") return "1536x1024";
  if (aspectRatio === "9:16" || aspectRatio === "4:5" || aspectRatio === "3:4") return "1024x1536";
  return "1024x1024";
}

async function enhancePromptViaOpenAI(
  apiKey: string,
  textModel: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: textModel,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[ai-generate-image] OpenAI text enhancement error:", res.status, errText);
    throw new Error(`OpenAI text API returned ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (text) return text.trim();
  throw new Error("OpenAI returned no enhanced prompt");
}

async function generateImageViaOpenAI(
  apiKey: string,
  imageModel: string,
  enhancedPrompt: string,
  aspectRatio: string,
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const size = aspectRatioToGptImageSize(aspectRatio);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: enhancedPrompt.slice(0, 4000),
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[ai-generate-image] OpenAI API error:", res.status, errText);
    throw new Error(`OpenAI API returned ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  if (data.data && data.data.length > 0) {
    const base64Data = data.data[0].b64_json;
    if (base64Data) {
      return { dataUrl: `data:image/png;base64,${base64Data}`, mimeType: "image/png" };
    }
    const url = data.data[0].url;
    if (url) {
      const imgRes = await fetch(url);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const base64 = uint8ArrayToBase64(bytes);
        return { dataUrl: `data:image/png;base64,${base64}`, mimeType: "image/png" };
      }
    }
  }
  return null;
}

// ============================================================
// Storage upload helper
// ============================================================

async function uploadToStorage(
  supabase: any,
  dataUrl: string,
  mimeType: string,
  companyId: string,
): Promise<string | null> {
  try {
    const base64Match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!base64Match) return null;
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
    const fileName = `${companyId}/${Date.now()}-${Math.floor(Math.random() * 9999)}.${ext}`;
    const binaryString = atob(base64Match[2]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const { error } = await supabase.storage
      .from("ai-generated-raw")
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("ai-generated-raw").getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch {
    return null;
  }
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let body: GenerateRequest;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[ai-generate-image] Failed to parse request body:", parseErr);
      return new Response(
        JSON.stringify({ error: "Invalid request body. Expected JSON with a 'prompt' field." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const {
      prompt,
      aspect_ratio = "4:5",
      reference_image,
      operation = "generate",
      negative_prompt,
      company_id,
      project_id,
      poster_mode = false,
      category_name,
      frame_orientation,
      business_industry,
      brand_color,
      regenerate = false,
      category_id,
      frame_id,
      provider: requestedProvider,
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Image prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ai-generate-image] Request received:", { provider: requestedProvider, poster_mode, prompt: prompt.slice(0, 80) });

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (poster_mode && company_id) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { data: company } = await supabase.from("companies").select("plan_id").eq("id", company_id).maybeSingle();
      const { data: planAccess } = await supabase.from("plan_feature_access").select("features").eq("plan_id", company?.plan_id || "starter").maybeSingle();
      const features = planAccess?.features as Record<string, unknown> | null;
      const monthlyLimit = typeof features?.ai_poster_monthly_limit === "number" ? features.ai_poster_monthly_limit : 30;
      const { count } = await supabase.from("ai_posters").select("id", { count: "exact", head: true }).eq("company_id", company_id).in("status", ["generated", "composed", "completed"]).gte("created_at", monthStart.toISOString());
      if ((count || 0) >= monthlyLimit) {
        return new Response(JSON.stringify({ error: "Monthly AI poster limit reached", monthly_limit: monthlyLimit }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load all API keys and model configs from DB, fall back to env vars
    let geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    let openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    let imageModel = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
    let textModel = Deno.env.get("GEMINI_TEXT_MODEL") || "gemini-2.0-flash";
    let openaiTextModel = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-5.6-luna";
    let openaiImageModel = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2";
    try {
      const { data: secretRows } = await supabase
        .from("platform_secrets")
        .select("key_name, key_value")
        .in("key_name", ["GEMINI_API_KEY", "OPENAI_API_KEY", "GEMINI_IMAGE_MODEL", "GEMINI_TEXT_MODEL", "OPENAI_TEXT_MODEL", "OPENAI_IMAGE_MODEL"]);
      for (const row of secretRows || []) {
        if (row.key_value && row.key_value.trim()) {
          if (row.key_name === "GEMINI_API_KEY") geminiApiKey = row.key_value;
          if (row.key_name === "OPENAI_API_KEY") openaiApiKey = row.key_value;
          if (row.key_name === "GEMINI_IMAGE_MODEL") imageModel = row.key_value;
          if (row.key_name === "GEMINI_TEXT_MODEL") textModel = row.key_value;
          if (row.key_name === "OPENAI_TEXT_MODEL") openaiTextModel = row.key_value;
          if (row.key_name === "OPENAI_IMAGE_MODEL") openaiImageModel = row.key_value;
        }
      }
    } catch { /* fall back to env */ }

    // Determine which provider to use
    const provider: ImageProvider = requestedProvider || "gemini";

    if (provider === "openai" && !openaiApiKey) {
      console.error("[ai-generate-image] OPENAI_API_KEY is missing in environment variables and platform_secrets table");
      return new Response(JSON.stringify({ error: "API key is missing in environment variables. Please add the OpenAI API key in Admin settings under Platform Secrets, or switch to Gemini." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (provider === "gemini" && !geminiApiKey) {
      console.error("[ai-generate-image] GEMINI_API_KEY is missing in environment variables and platform_secrets table");
      return new Response(JSON.stringify({ error: "API key is missing in environment variables. Please add the Gemini API key in Admin settings under Platform Secrets, or switch to OpenAI GPT-Image-2." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = provider === "gemini" ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

    // ===== POSTER MODE: Two-step generation =====
    if (poster_mode) {
      const orientation = frame_orientation || "portrait";
      const ar = orientationToAspectRatio(orientation);
      const industry = business_industry || "";
      const bColor = brand_color || "#5648db";

      // Step A: Prompt enhancement — uses GPT-5.6 Luna for OpenAI, Gemini text model for Gemini
      let enhancedPrompt: string;
      if (provider === "openai" && openaiApiKey) {
        try {
          const systemInstruction = buildPosterSystemInstruction(category_name || "Custom", industry, bColor, orientation);
          const userMessage = buildPosterUserPrompt(prompt, category_name || "Custom", industry, regenerate);
          enhancedPrompt = await enhancePromptViaOpenAI(openaiApiKey, openaiTextModel, systemInstruction, userMessage);
        } catch (err) {
          console.error("[ai-generate-image] OpenAI prompt enhancement failed, using fallback:", err);
          enhancedPrompt = buildEnhancedPrompt(prompt, "generate");
        }
      } else if (geminiApiKey && ai) {
        try {
          const systemInstruction = buildPosterSystemInstruction(category_name || "Custom", industry, bColor, orientation);
          const userMessage = buildPosterUserPrompt(prompt, category_name || "Custom", industry, regenerate);
          enhancedPrompt = await enhancePromptViaGemini(ai, textModel, systemInstruction, userMessage);
        } catch {
          enhancedPrompt = buildEnhancedPrompt(prompt, "generate");
        }
      } else {
        enhancedPrompt = buildEnhancedPrompt(prompt, "generate");
      }

      // Step B: Image generation via selected provider
      let imageResult: { dataUrl: string; mimeType: string } | null = null;
      try {
        if (provider === "openai") {
          imageResult = await generateImageViaOpenAI(openaiApiKey, openaiImageModel, enhancedPrompt, ar);
        } else if (ai) {
          if (isImagenModel(imageModel)) {
            imageResult = await generateImageViaImagen(ai, imageModel, enhancedPrompt, ar);
          } else {
            imageResult = await generateImageViaGemini(ai, imageModel, enhancedPrompt, ar);
          }
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: formatProviderError(provider, err) }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!imageResult) {
        return new Response(JSON.stringify({ error: `${provider === "openai" ? "OpenAI" : "Gemini"} returned a response without an image. Please try a different prompt or try again.` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let publicUrl: string | null = null;
      if (company_id) {
        publicUrl = await uploadToStorage(supabase, imageResult.dataUrl, imageResult.mimeType, company_id);
      }
      const finalImageUrl = publicUrl || imageResult.dataUrl;

      let posterId: string | null = null;
      if (company_id) {
        try {
          const { data: posterRow } = await supabase.from("ai_posters").insert({
            company_id,
            category_id: category_id || null,
            frame_id: frame_id || null,
            user_prompt: prompt,
            enhanced_prompt: enhancedPrompt,
            generated_image_url: finalImageUrl,
            status: "generated",
          }).select("id").single();
          posterId = posterRow?.id || null;
        } catch { /* best-effort */ }

        try {
          await supabase.from("ai_usage").insert({
            company_id,
            operation: "poster_generate",
            model: provider === "openai" ? openaiImageModel : imageModel,
            quantity: 1,
            status: "success",
          });
        } catch { /* best-effort */ }
      }

      return new Response(
        JSON.stringify({
          image_url: finalImageUrl,
          enhanced_prompt: enhancedPrompt,
          model: provider === "openai" ? openaiImageModel : imageModel,
          provider,
          poster_mode: true,
          poster_id: posterId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== STANDARD MODE =====
    const enhancedPrompt = buildEnhancedPrompt(prompt, operation, negative_prompt);

    let dataUrl: string | null = null;
    let mimeType = "image/png";

    try {
      if (provider === "openai") {
        const result = await generateImageViaOpenAI(openaiApiKey, openaiImageModel, enhancedPrompt, aspect_ratio);
        if (result) {
          dataUrl = result.dataUrl;
          mimeType = result.mimeType;
        }
      } else if (ai) {
        if (isImagenModel(imageModel)) {
          const result = await generateImageViaImagen(ai, imageModel, enhancedPrompt, aspect_ratio, negative_prompt);
          if (result) {
            dataUrl = result.dataUrl;
            mimeType = result.mimeType;
          }
        } else {
          const result = await generateImageViaGemini(ai, imageModel, enhancedPrompt, aspect_ratio, reference_image, operation);
          if (result) {
            dataUrl = result.dataUrl;
            mimeType = result.mimeType;
          }
        }
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: formatProviderError(provider, err) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dataUrl) {
      return new Response(JSON.stringify({ error: `${provider === "openai" ? "OpenAI" : "Gemini"} returned a response without an image. Please try a different prompt or try again.` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (company_id) {
      try {
        await supabase.from("ai_usage").insert({
          company_id,
          operation,
          model: provider === "openai" ? openaiImageModel : imageModel,
          quantity: 1,
          status: "success",
        });

        if (project_id) {
          await supabase.from("ai_assets").insert({
            project_id,
            company_id,
            type: operation === "generate" ? "generated" : operation,
            source: "ai",
            image_url: dataUrl,
            prompt,
            metadata: {
              enhanced_prompt: enhancedPrompt,
              aspect_ratio,
              model: provider === "openai" ? openaiImageModel : imageModel,
              negative_prompt: negative_prompt,
            },
          });
        }
      } catch {
        // Usage tracking is best-effort
      }
    }

    return new Response(
      JSON.stringify({
        image_url: dataUrl,
        prompt: enhancedPrompt,
        model: provider === "openai" ? openaiImageModel : imageModel,
        provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : "";
    console.error("[ai-generate-image] Unhandled error:", errMsg);
    if (errStack) console.error("[ai-generate-image] Stack:", errStack);
    return new Response(
      JSON.stringify({ error: `Image generation failed: ${errMsg.slice(0, 300)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
