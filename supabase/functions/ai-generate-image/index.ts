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

  // Append negative prompt if provided
  if (negativePrompt) {
    enhanced += `. Avoid: ${negativePrompt}.`;
  }

  // Always ensure no-text instruction
  if (!enhanced.toLowerCase().includes("no text")) {
    enhanced += ". No text, no watermark, no logo, no letters, no words.";
  }

  return enhanced;
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
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Image prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const imageModel =
      Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image-preview";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dims = aspectRatioToDimensions(aspect_ratio);
    const enhancedPrompt = buildEnhancedPrompt(prompt, operation, negative_prompt);

    // Build the Gemini API request
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;

    const parts: any[] = [{ text: enhancedPrompt }];

    // If reference image provided (for edit/remove_bg/enhance operations)
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

      // Extract image from response — Gemini returns inline_data with base64
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

    // Fallback to Pollinations.ai if Gemini doesn't return an image
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

    // Final fallback: branded SVG placeholder
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

    // Track usage in database
    if (company_id) {
      try {
        const { createClient } = await import("npm:@supabase/supabase-js@2");
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

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
