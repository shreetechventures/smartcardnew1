'use client';

import { useEffect, useRef, useCallback } from 'react';

export type TemplateElement = {
  id: string;
  type: 'background' | 'image' | 'text' | 'logo' | 'qr' | 'shape';
  x: number;
  y: number;
  width: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  background?: string;
  textAlign?: string;
  borderRadius?: number;
  padding?: number;
  qrType?: string;
};

export type TemplateDef = {
  elements: TemplateElement[];
};

export type PosterRenderData = {
  template: TemplateDef;
  heroImage: string | null;
  logoUrl: string | null;
  copy: {
    headline: string;
    subheadline: string;
    offer_text: string;
    cta_text: string;
  };
  brand: {
    business_name: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    phone: string;
    email: string;
    website: string;
    address: string;
  };
  qrUrl: string;
  aspectRatio: string;
};

const CANVAS_DIMS: Record<string, { w: number; h: number }> = {
  '4:5': { w: 1080, h: 1350 },
  '1:1': { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
};

export function usePosterRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(async (data: PosterRenderData) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const dims = CANVAS_DIMS[data.aspectRatio] || CANVAS_DIMS['4:5'];
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill background with brand primary color
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dims.w, dims.h);

    // Load images
    const loadImage = (url: string | null): Promise<HTMLImageElement | null> => {
      if (!url) return Promise.resolve(null);
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    };

    const [heroImg, logoImg] = await Promise.all([
      loadImage(data.heroImage),
      loadImage(data.logoUrl),
    ]);

    // Render elements in order
    for (const el of data.template.elements) {
      const scale = dims.w / 1080;
      const x = el.x * scale;
      const y = el.y * scale;
      const w = el.width * scale;
      const h = (el.height || 0) * scale;

      switch (el.type) {
        case 'background': {
          if (data.brand.primary_color) {
            ctx.fillStyle = data.brand.primary_color;
            ctx.fillRect(0, 0, dims.w, dims.h);
          }
          break;
        }
        case 'image': {
          if (heroImg) {
            const radius = (el.borderRadius || 0) * scale;
            if (radius > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(x, y, w, h || (w * 0.7), radius);
              ctx.clip();
            }
            // Cover fit
            const imgAspect = heroImg.width / heroImg.height;
            const boxAspect = w / (h || w * 0.7);
            let sx = 0, sy = 0, sw = heroImg.width, sh = heroImg.height;
            if (imgAspect > boxAspect) {
              sw = heroImg.height * boxAspect;
              sx = (heroImg.width - sw) / 2;
            } else {
              sh = heroImg.width / boxAspect;
              sy = (heroImg.height - sh) / 2;
            }
            ctx.drawImage(heroImg, sx, sy, sw, sh, x, y, w, h || w * 0.7);
            if (radius > 0) ctx.restore();
          }
          break;
        }
        case 'text': {
          const text = getTextValue(el.id, data);
          if (!text) break;
          const fontSize = (el.fontSize || 28) * scale;
          ctx.font = `${el.fontWeight || 'normal'} ${fontSize}px Plus Jakarta Sans, sans-serif`;
          ctx.fillStyle = el.color || '#ffffff';
          ctx.textAlign = (el.textAlign as CanvasTextAlign) || 'left';
          const py = y + (el.padding || 0) * scale;

          // Background for badges/CTAs
          if (el.background) {
            ctx.fillStyle = el.background;
            const padX = (el.padding || 16) * scale;
            const padY = (el.padding || 16) * scale * 0.5;
            const textWidth = ctx.measureText(text).width;
            const bgX = el.textAlign === 'center' ? x + (w - textWidth) / 2 - padX : x - padX;
            const bgW = textWidth + padX * 2;
            const bgH = fontSize + padY * 2;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(bgX, py - padY, bgW, bgH, (el.borderRadius || 8) * scale);
            } else {
              ctx.rect(bgX, py - padY, bgW, bgH);
            }
            ctx.fill();
            ctx.fillStyle = el.color || '#ffffff';
          }

          // Word wrap
          const maxWidth = w;
          const lines = wrapText(ctx, text, maxWidth);
          lines.forEach((line, i) => {
            let lx = x;
            if (el.textAlign === 'center') {
              lx = x + (w - ctx.measureText(line).width) / 2;
            }
            ctx.fillText(line, lx, py + fontSize * (i + 1) * 1.1);
          });
          break;
        }
        case 'logo': {
          if (logoImg) {
            const lw = w;
            const lh = (logoImg.height / logoImg.width) * lw;
            ctx.drawImage(logoImg, x, y, lw, lh);
          } else if (data.brand.business_name) {
            const fontSize = (el.fontSize || 24) * scale;
            ctx.font = `bold ${fontSize}px Plus Jakarta Sans, sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(data.brand.business_name, x, y + fontSize);
          }
          break;
        }
        case 'qr': {
          if (data.qrUrl) {
            const qrImg = await loadImage(
              `https://api.qrserver.com/v1/create-qr-code/?size=${Math.round(w)}x${Math.round(w)}&data=${encodeURIComponent(data.qrUrl)}`
            );
            if (qrImg) {
              ctx.drawImage(qrImg, x, y, w, w);
            }
          }
          break;
        }
      }
    }

    return canvas.toDataURL('image/png');
  }, []);

  return { canvasRef, render };
}

function getTextValue(id: string, data: PosterRenderData): string {
  const copyMap: Record<string, string> = {
    headline: data.copy.headline,
    subheadline: data.copy.subheadline,
    offer_text: data.copy.offer_text,
    offer_badge: data.copy.offer_text,
    cta: data.copy.cta_text,
    business_name: data.brand.business_name,
    date_badge: '',
    stars: '★★★★★',
  };
  return copyMap[id] || '';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
