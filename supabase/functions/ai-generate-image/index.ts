const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

async function enhancePromptViaGemini(
  apiKey: string,
  textModel: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini text call failed: ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no enhanced prompt");
  return text.trim();
}

async function generateImageViaGemini(
  apiKey: string,
  imageModel: string,
  enhancedPrompt: string,
  aspectRatio: string,
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const dims = aspectRatioToDimensions(aspectRatio);
  const fullPrompt = `${enhancedPrompt}. Image dimensions: approximately ${dims.width}x${dims.height} pixels, aspect ratio ${aspectRatio}.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseModalities: ["TEXT", "IMAGE"],
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.candidates?.[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inline_data) {
        const mimeType = part.inline_data.mime_type || "image/png";
        return { dataUrl: `data:${mimeType};base64,${part.inline_data.data}`, mimeType };
      }
    }
  }
  return null;
}

async function generateImageFallback(
  enhancedPrompt: string,
  aspectRatio: string,
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const dims = aspectRatioToDimensions(aspectRatio);
  try {
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims.width}&height=${dims.height}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
    const imgRes = await fetch(fallbackUrl);
    if (imgRes.ok) {
      const imageBlob = await imgRes.blob();
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return { dataUrl: `data:${imageBlob.type};base64,${base64}`, mimeType: imageBlob.type };
    }
  } catch {
    // fall through
  }
  return null;
}

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
    const { data, error } = await supabase.storage
      .from("ai-generated-raw")
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("ai-generated-raw").getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: GenerateRequest = await req.json();
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
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Image prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read API keys and models from database first, fall back to env vars
    let apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    let imageModel = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image-preview";
    let textModel = Deno.env.get("GEMINI_TEXT_MODEL") || "gemini-2.0-flash";
    try {
      const { data: secretRows } = await supabase
        .from("platform_secrets")
        .select("key_name, key_value")
        .in("key_name", ["GEMINI_API_KEY", "GEMINI_IMAGE_MODEL", "GEMINI_TEXT_MODEL"]);
      for (const row of secretRows || []) {
        if (row.key_value) {
          if (row.key_name === "GEMINI_API_KEY") apiKey = row.key_value;
          if (row.key_name === "GEMINI_IMAGE_MODEL") imageModel = row.key_value;
          if (row.key_name === "GEMINI_TEXT_MODEL") textModel = row.key_value;
        }
      }
    } catch { /* fall back to env */ }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== POSTER MODE: Two-step Gemini generation =====
    if (poster_mode) {
      const orientation = frame_orientation || "portrait";
      const ar = orientationToAspectRatio(orientation);
      const industry = business_industry || "";
      const bColor = brand_color || "#5648db";

      // CALL A — Prompt Enhancement
      const systemInstruction = buildPosterSystemInstruction(category_name || "Custom", industry, bColor, orientation);
      const userMessage = buildPosterUserPrompt(prompt, category_name || "Custom", industry, regenerate);

      let enhancedPrompt: string;
      try {
        enhancedPrompt = await enhancePromptViaGemini(apiKey, textModel, systemInstruction, userMessage);
      } catch {
        if (company_id) {
          await supabase.from("ai_posters").insert({ company_id, category_id: category_id || null, frame_id: frame_id || null, user_prompt: prompt, status: "failed" });
        }
        return new Response(JSON.stringify({ error: "Prompt enhancement failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CALL B — Image Generation
      const imageResult = await generateImageViaGemini(apiKey, imageModel, enhancedPrompt, ar);

      if (!imageResult) {
        if (company_id) {
          await supabase.from("ai_posters").insert({ company_id, category_id: category_id || null, frame_id: frame_id || null, user_prompt: prompt, enhanced_prompt: enhancedPrompt, status: "failed" });
        }
        return new Response(JSON.stringify({ error: "Image generation failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload to Storage and get public URL
      let publicUrl: string | null = null;
      if (company_id) {
        publicUrl = await uploadToStorage(supabase, imageResult.dataUrl, imageResult.mimeType, company_id);
      }
      const finalImageUrl = publicUrl || imageResult.dataUrl;

      // Insert ai_posters record
      if (company_id) {
        try {
          await supabase.from("ai_posters").insert({
            company_id,
            category_id: category_id || null,
            frame_id: frame_id || null,
            user_prompt: prompt,
            enhanced_prompt: enhancedPrompt,
            generated_image_url: finalImageUrl,
            status: "generated",
          });
        } catch { /* best-effort */ }

        try {
          await supabase.from("ai_usage").insert({
            company_id,
            operation: "poster_generate",
            model: imageModel,
            quantity: 1,
            status: "success",
          });
        } catch { /* best-effort */ }
      }

      return new Response(
        JSON.stringify({
          image_url: finalImageUrl,
          enhanced_prompt: enhancedPrompt,
          model: imageModel,
          provider: "gemini",
          poster_mode: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== STANDARD MODE (original behavior) =====
    const dims = aspectRatioToDimensions(aspect_ratio);
    const enhancedPrompt = buildEnhancedPrompt(prompt, operation, negative_prompt);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;

    const parts: any[] = [{ text: enhancedPrompt }];

    if (
      reference_image &&
      (operation === "edit" || operation === "remove_bg" || operation === "enhance")
    ) {
      const base64Match = reference_image.match(/^data:(.+?);base64,(.+)$/);
      if (base64Match) {
        parts.push({
          inline_data: {
            mime_type: base64Match[1],
            data: base64Match[2],
          },
        });
      }
    }

    const geminiBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    let dataUrl: string | null = null;

    if (geminiRes.ok) {
      const geminiData = await geminiRes.json();
      if (geminiData.candidates && geminiData.candidates[0]?.content?.parts) {
        for (const part of geminiData.candidates[0].content.parts) {
          if (part.inline_data) {
            const mimeType = part.inline_data.mime_type || "image/png";
            const base64Data = part.inline_data.data;
            dataUrl = `data:${mimeType};base64,${base64Data}`;
            break;
          }
        }
      }
    }

    if (!dataUrl) {
      try {
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims.width}&height=${dims.height}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
        const imgRes = await fetch(fallbackUrl);
        if (imgRes.ok) {
          const imageBlob = await imgRes.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(arrayBuffer)),
          );
          dataUrl = `data:${imageBlob.type};base64,${base64}`;
        }
      } catch {
        // Fall through to SVG fallback
      }
    }

    if (!dataUrl) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${dims.width} ${dims.height}">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#5648db"/><stop offset="100%" stop-color="#0ea5e9"/>
        </linearGradient></defs>
        <rect width="${dims.width}" height="${dims.height}" fill="url(#g)"/>
        <text x="${dims.width / 2}" y="${dims.height / 2 - 20}" font-family="sans-serif" font-size="36" fill="white" text-anchor="middle" opacity="0.9">AI Image Preview</text>
        <text x="${dims.width / 2}" y="${dims.height / 2 + 30}" font-family="sans-serif" font-size="18" fill="white" text-anchor="middle" opacity="0.7">${prompt.slice(0, 80)}</text>
      </svg>`;
      const base64Svg = btoa(unescape(encodeURIComponent(svg)));
      dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
    }

    if (company_id) {
      try {
        await supabase.from("ai_usage").insert({
          company_id,
          operation,
          model: imageModel,
          quantity: 1,
          status: dataUrl ? "success" : "failed",
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
              model: imageModel,
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
        model: imageModel,
        provider: "gemini",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
