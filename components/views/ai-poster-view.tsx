'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, Frame, Image as ImageIcon, Loader2, RefreshCw, Share2, Sparkles, WandSparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type PosterCategory = {
  id: string;
  name: string;
  name_local: string | null;
  icon: string | null;
};

type PosterFrame = {
  id: string;
  category_id: string | null;
  name: string;
  thumbnail_url: string | null;
  orientation: 'square' | 'portrait' | 'story' | 'landscape';
  canvas_width: number;
  canvas_height: number;
  layout_json: Record<string, unknown>;
};

type BusinessProfile = {
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  industry: string | null;
};

type DownloadSize = 'full' | 'instagram' | 'whatsapp' | 'facebook';

type WizardState = {
  category: PosterCategory | null;
  frame: PosterFrame | null;
  prompt: string;
  generatedImageUrl: string;
  enhancedPrompt: string;
  finalPosterUrl: string;
};

const steps = [
  { label: 'Select Category', short: 'Category' },
  { label: 'Select Frame', short: 'Frame' },
  { label: 'Describe Your Image', short: 'Prompt' },
  { label: 'Generate & Preview', short: 'Preview' },
  { label: 'Compose', short: 'Compose' },
  { label: 'Download', short: 'Download' },
];

const categoryEmoji: Record<string, string> = {
  Festival: '🎉',
  'Good Morning': '☀️',
  'Business Promotion': '📢',
  Condolence: '🙏',
  Custom: '✨',
};

const orientationLabels: Record<string, string> = {
  square: 'Square',
  portrait: 'Portrait',
  story: 'Story',
  landscape: 'Landscape',
};

const orientationBadgeClass: Record<string, string> = {
  square: 'ai-orient-badge square',
  portrait: 'ai-orient-badge portrait',
  story: 'ai-orient-badge story',
  landscape: 'ai-orient-badge landscape',
};

const quickIdeas: Record<string, string[]> = {
  Festival: [
    'Diwali diyas glowing warmly on a decorated thali with marigold flowers',
    'Ganesh idol with modak and festive decorations in soft golden light',
    'Colorful rangoli design with diyas and flowers from above',
  'Holi colors splashing in celebration with vibrant powder clouds',
  ],
  'Good Morning': [
    'Sunrise over misty hills with a steaming cup of chai on a wooden table',
    'Fresh morning flowers with dew drops in soft natural light',
    'A bright open window with morning sunlight and a cup of coffee',
    'Birds flying over a serene lake at dawn with warm golden tones',
  ],
  'Business Promotion': [
    'Two professionals shaking hands in a bright modern office',
    'A sleek product display on a minimalist podium with spotlight lighting',
    'A team collaborating around a glass conference table with city views',
    'An elegant storefront window with warm inviting lighting at dusk',
  ],
  Condolence: [
    'A single white flower resting on still water with soft candlelight',
    'White chrysanthemums arranged peacefully with a gentle candle glow',
    'A serene landscape at sunset with soft muted tones and quiet dignity',
    'A simple lit candle surrounded by white petals in soft focus',
  ],
  Custom: [
    'An abstract creative composition with flowing colors and modern textures',
    'A professional flat-lay of business items on a clean marble surface',
    'A warm lifestyle scene with soft bokeh and natural lighting',
    'A bold geometric pattern with your brand colors in a modern style',
  ],
};

const promptPlaceholders: Record<string, string> = {
  Festival: 'उदा. दिवाळीच्या दिवाण्यांसह सजवलेला थाळी आणि मरीगोल्ड फुले',
  'Good Morning': 'उदा. धुक्याच्या डोंगरावर चहाचा कप आणि सकाळचा सूर्यप्रकाश',
  'Business Promotion': 'उदा. दोन व्यावसायिक व्यक्ती हस्तांदोलन करत आधुनिक कार्यालयात',
  Condolence: 'उदा. शांत पाण्यावर एक पांढरे फूल आणि मेणबत्तीचा विझ',
  Custom: 'उदा. तुमच्या व्यवसायाशी संबंधित एक सुंदर दृश्य',
};

export function AiPosterView() {
  const { companyId } = useAuth();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<PosterCategory[]>([]);
  const [frames, setFrames] = useState<PosterFrame[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [composedDataUrl, setComposedDataUrl] = useState('');
  const [posterId, setPosterId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [successUrl, setSuccessUrl] = useState('');
  const [wizard, setWizard] = useState<WizardState>({
    category: null,
    frame: null,
    prompt: '',
    generatedImageUrl: '',
    enhancedPrompt: '',
    finalPosterUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      const [categoryRes, frameRes, profileRes] = await Promise.all([
        supabase.from('poster_categories').select('id,name,name_local,icon').eq('is_active', true).order('sort_order'),
        supabase.from('poster_frames').select('id,category_id,name,thumbnail_url,orientation,canvas_width,canvas_height,layout_json').eq('is_active', true).order('created_at'),
        supabase.from('business_profile').select('business_name,tagline,logo_url,primary_color,secondary_color,phone,email,website,address,city,state,pincode').maybeSingle(),
      ]);
      if (!mounted) return;
      if (categoryRes.error || frameRes.error) setError('The poster catalog could not be loaded.');
      setCategories((categoryRes.data as PosterCategory[]) || []);
      setFrames((frameRes.data as PosterFrame[]) || []);
      const profile = profileRes.data as Omit<BusinessProfile, 'industry'> | null;
      if (profile) setBusinessProfile({ ...profile, primary_color: profile.primary_color || '#5648db', industry: null });
      setLoading(false);
    };
    loadCatalog();
    return () => { mounted = false; };
  }, []);

  const visibleFrames = useMemo(() => {
    if (!wizard.category) return frames;
    return frames.filter(frame => !frame.category_id || frame.category_id === wizard.category?.id);
  }, [frames, wizard.category]);

  const updateWizard = (changes: Partial<WizardState>) => setWizard(current => ({ ...current, ...changes }));

  const canContinue = [
    Boolean(wizard.category),
    Boolean(wizard.frame),
    wizard.prompt.trim().length >= 8,
    Boolean(wizard.generatedImageUrl),
    Boolean(wizard.finalPosterUrl),
    Boolean(composedDataUrl),
  ][step - 1];

  const generatePoster = async (regenerate = false, onComplete?: () => void) => {
    if (!wizard.prompt.trim() || !wizard.frame) return;
    setGenerating(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('ai-generate-image', {
      body: {
        prompt: wizard.prompt.trim(),
        poster_mode: true,
        category_id: wizard.category?.id,
        frame_id: wizard.frame.id,
        category_name: wizard.category?.name || 'Custom',
        frame_orientation: wizard.frame.orientation,
        business_industry: businessProfile?.industry || '',
        brand_color: businessProfile?.primary_color || '#5648db',
        company_id: companyId || undefined,
        regenerate,
      },
    });
    if (invokeError || !data?.image_url) {
      setError('Image तयार करता आली नाही, पुन्हा प्रयत्न करा');
      setGenerating(false);
      return;
    }
    updateWizard({ generatedImageUrl: data.image_url, enhancedPrompt: data.enhanced_prompt || wizard.prompt.trim(), finalPosterUrl: '' });
    setPosterId(data.poster_id || '');
    setComposedDataUrl('');
    setGenerating(false);
    onComplete?.();
  };

  const composePoster = () => {
    if (!wizard.generatedImageUrl) return;
    updateWizard({ finalPosterUrl: wizard.generatedImageUrl });
  };

  const exportImage = async (size: DownloadSize): Promise<string> => {
    const sourceUrl = composedDataUrl || wizard.finalPosterUrl || wizard.generatedImageUrl;
    if (!sourceUrl) throw new Error('No poster is ready');
    const dimensions: Record<DownloadSize, { width: number; height: number }> = {
      full: { width: wizard.frame?.canvas_width || 1080, height: wizard.frame?.canvas_height || 1350 },
      instagram: { width: 1080, height: 1080 },
      whatsapp: { width: 1080, height: 1920 },
      facebook: { width: 1200, height: 630 },
    };
    const target = dimensions[size];
    if (size === 'full') return sourceUrl;
    const image = new Image();
    image.src = sourceUrl;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not prepare export')); });
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare export');
    const scale = Math.max(target.width / image.naturalWidth, target.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (target.width - width) / 2, (target.height - height) / 2, width, height);
    return canvas.toDataURL('image/png');
  };

  const handleDownload = async (size: DownloadSize = 'full') => {
    if (!wizard.category || !businessProfile) return;
    setExporting(true);
    setError('');
    try {
      const dataUrl = await exportImage(size);
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const date = new Date().toISOString().slice(0, 10);
      const safeName = `${businessProfile.business_name || 'business'}-${wizard.category.name}-${date}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const path = `${companyId || 'unassigned'}/${safeName}-${size}.png`;
      const { error: uploadError } = await supabase.storage.from('final-posters').upload(path, blob, { contentType: 'image/png', upsert: true });
      if (uploadError) throw new Error('Upload failed');
      const { data: publicData } = supabase.storage.from('final-posters').getPublicUrl(path);
      const finalUrl = publicData.publicUrl;
      if (posterId) {
        const { error: updateError } = await supabase.from('ai_posters').update({ final_poster_url: finalUrl, status: 'completed' }).eq('id', posterId);
        if (updateError) throw new Error('Poster update failed');
      }
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${safeName}-${size}.png`;
      link.click();
      setSuccessUrl(finalUrl);
    } catch {
      setError('पोस्टर डाउनलोड करता आला नाही, पुन्हा प्रयत्न करा');
    } finally {
      setExporting(false);
    }
  };

  const sharePoster = async () => {
    if (!successUrl) return;
    const shareData = { title: 'AI Poster', text: 'माझा नवीन पोस्टर पहा', url: successUrl };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareData.text}: ${successUrl}`)}`, '_blank', 'noopener,noreferrer');
  };

  const resetWizard = () => {
    setStep(1);
    setPosterId('');
    setComposedDataUrl('');
    setSuccessUrl('');
    setError('');
    setWizard({ category: null, frame: null, prompt: '', generatedImageUrl: '', enhancedPrompt: '', finalPosterUrl: '' });
  };

  const next = () => {
    if (step === 3) {
      setStep(4);
      if (!wizard.generatedImageUrl) void generatePoster(false);
      return;
    }
    if (step === 4 && !wizard.finalPosterUrl) composePoster();
    if (step === 5) {
      setStep(6);
      return;
    }
    if (step === 6) {
      const link = document.createElement('a');
      link.href = composedDataUrl || wizard.finalPosterUrl || wizard.generatedImageUrl;
      link.download = 'thesmartcard-ai-poster.png';
      link.click();
      return;
    }
    setStep(current => current + 1);
  };

  const back = () => {
    if (step > 1) setStep(current => current - 1);
  };

  return (
    <div className="ai-poster-client">
      <div className="ai-poster-stepper" aria-label="AI Poster steps">
        {steps.map((item, index) => {
          const number = index + 1;
          const completed = number < step;
          return (
            <div className={`ai-step ${number === step ? 'current' : ''} ${completed ? 'completed' : ''}`} key={item.label}>
              <div className="ai-step-marker">{completed ? <Check size={15} /> : number}</div>
              <span>{item.label}</span>
              {number < steps.length && <i />}
            </div>
          );
        })}
      </div>

      <section className="panel ai-poster-panel">
        {loading ? <div className="ai-poster-loading"><Loader2 className="spin" size={28} /><p>Loading poster studio...</p></div> : (
          <>
            {step === 1 && <CategoryStep categories={categories} selected={wizard.category} onSelect={category => updateWizard({ category, frame: null })} />}
            {step === 2 && <FrameStep frames={visibleFrames} selected={wizard.frame} onSelect={frame => updateWizard({ frame })} />}
            {step === 3 && <PromptStep prompt={wizard.prompt} onChange={prompt => updateWizard({ prompt })} category={wizard.category} />}
            {step === 4 && <PreviewStep imageUrl={wizard.generatedImageUrl} prompt={wizard.enhancedPrompt} generating={generating} error={error} onRegenerate={() => generatePoster(true)} onUseImage={() => { composePoster(); setStep(5); }} />}
            {step === 5 && wizard.frame && <ComposeStep imageUrl={wizard.finalPosterUrl || wizard.generatedImageUrl} frame={wizard.frame} frames={visibleFrames} profile={businessProfile} exporting={exporting} onDownload={handleDownload} onCreateAnother={resetWizard} onFrameSelect={frame => updateWizard({ frame })} onRegenerate={() => { setStep(4); void generatePoster(true, () => setStep(5)); }} onRendered={setComposedDataUrl} />}
            {step === 6 && <DownloadStep imageUrl={composedDataUrl || wizard.finalPosterUrl || wizard.generatedImageUrl} exporting={exporting} onDownload={handleDownload} />}
            {successUrl && <div className="ai-poster-success-toast" role="status"><div><strong>पोस्टर तयार झाला! 🎉</strong><span>Your final poster is saved and ready to share.</span></div><button className="ghost-btn" onClick={sharePoster}><Share2 size={15} /> Share on WhatsApp</button><button className="ai-toast-close" onClick={() => setSuccessUrl('')} aria-label="Close">×</button></div>}

            {error && step !== 4 && <div className="ai-poster-error">{error}</div>}
            <div className="ai-poster-footer">
              <button className="ghost-btn" onClick={back} disabled={step === 1}><ArrowLeft size={16} /> Back</button>
              <button className="primary-btn" onClick={next} disabled={!canContinue || generating}>
                {step === 3 ? <><Sparkles size={16} /> Generate</> : step === 5 ? <><ArrowRight size={16} /> Next: Download</> : step === 6 ? <><Download size={16} /> Download Poster</> : < >Next <ArrowRight size={16} /></>}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CategoryStep({ categories, selected, onSelect }: { categories: PosterCategory[]; selected: PosterCategory | null; onSelect: (category: PosterCategory) => void }) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Sparkles size={20} /></span><div><h2>What kind of poster are you creating?</h2><p>Choose a category to find the right visual direction.</p></div></div>
      <div className="ai-category-chips" role="tablist" aria-label="Poster categories">
        {categories.map(category => {
          const emoji = categoryEmoji[category.name] || '✨';
          const isSelected = selected?.id === category.id;
          return (
            <button className={`ai-category-chip ${isSelected ? 'selected' : ''}`} key={category.id} onClick={() => onSelect(category)} role="tab" aria-selected={isSelected}>
              <span className="ai-chip-emoji">{emoji}</span>
              <span className="ai-chip-label">{category.name_local || category.name}</span>
              {isSelected && <Check size={15} className="ai-chip-check" />}
            </button>
          );
        })}
      </div>
      {categories.length === 0 && <div className="ai-empty-state"><Sparkles size={34} /><p>No active categories are available yet.</p></div>}
    </div>
  );
}

function FrameStep({ frames, selected, onSelect }: { frames: PosterFrame[]; selected: PosterFrame | null; onSelect: (frame: PosterFrame) => void }) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Frame size={20} /></span><div><h2>Choose a frame for your brand</h2><p>Select the layout that will hold your business information.</p></div></div>
      {frames.length === 0 ? (
        <div className="ai-frame-empty">
          <Frame size={40} />
          <h3>Frames लवकरच येत आहेत</h3>
          <p>New frame designs for this category are on the way.</p>
          <a className="ai-frame-request-link" href="mailto:support@thesmartcard.in?subject=Request%20custom%20poster%20frame">Request a custom frame</a>
        </div>
      ) : (
        <div className="ai-frame-grid" role="radiogroup" aria-label="Poster frames">
          {frames.map(frame => {
            const isSelected = selected?.id === frame.id;
            return (
              <button className={`ai-frame-card ${isSelected ? 'selected' : ''}`} key={frame.id} onClick={() => onSelect(frame)} role="radio" aria-checked={isSelected}>
                {isSelected && <span className="ai-frame-check"><Check size={16} /></span>}
                <div className={`ai-frame-thumb ${frame.orientation}`}>
                  {frame.thumbnail_url ? <img src={frame.thumbnail_url} alt={frame.name} /> : <><ImageIcon size={30} /><span>{orientationLabels[frame.orientation] || frame.orientation}</span></>}
                  <span className={orientationBadgeClass[frame.orientation] || 'ai-orient-badge'}>{orientationLabels[frame.orientation] || frame.orientation}</span>
                </div>
                <div className="ai-frame-info"><strong>{frame.name}</strong><small>{frame.canvas_width} × {frame.canvas_height}</small></div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptStep({ prompt, onChange, category }: { prompt: string; onChange: (value: string) => void; category: PosterCategory | null }) {
  const categoryName = category?.name || 'Custom';
  const ideas = quickIdeas[categoryName] || quickIdeas['Custom'];
  const placeholder = promptPlaceholders[categoryName] || promptPlaceholders['Custom'];

  return (
    <div className="ai-wizard-step ai-prompt-step">
      <div className="ai-step-heading">
        <span className="ai-heading-icon"><WandSparkles size={20} /></span>
        <div>
          <h2>तुम्हाला कसा फोटो/इमेज हवी आहे ते थोडक्यात लिहा</h2>
          <p>Describe the image you want — AI will create it without any text or logos.</p>
        </div>
      </div>
      <label className="ai-prompt-label" htmlFor="poster-prompt-client">Your image prompt</label>
      <textarea
        id="poster-prompt-client"
        className="ai-prompt-input"
        value={prompt}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={800}
      />
      <div className="ai-prompt-meta">
        <span>AI will create an image without text or logos.</span>
        <span>{prompt.length}/800</span>
      </div>
      <div className="ai-quick-ideas">
        <span className="ai-quick-ideas-label">Quick ideas:</span>
        <div className="ai-idea-chips">
          {ideas.map((idea, index) => (
            <button
              key={index}
              className="ai-idea-chip"
              onClick={() => onChange(idea)}
              type="button"
            >
              {idea}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewStep({ imageUrl, prompt, generating, error, onRegenerate, onUseImage }: {
  imageUrl: string;
  prompt: string;
  generating: boolean;
  error: string;
  onRegenerate: () => void;
  onUseImage: () => void;
}) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading">
        <span className="ai-heading-icon"><Sparkles size={20} /></span>
        <div>
          <h2>Review your generated image</h2>
          <p>Use this image or regenerate for a different creative direction.</p>
        </div>
      </div>

      {generating ? (
        <div className="ai-poster-generating">
          <div className="ai-gen-spinner"><Loader2 size={40} className="spin" /></div>
          <h3>तुमची इमेज तयार होत आहे...</h3>
          <p>AI prompt enhancement and image generation in progress (~10-20 seconds)</p>
          <div className="ai-gen-progress-bar"><i /></div>
        </div>
      ) : error ? (
        <div className="ai-poster-error-state">
          <ImageIcon size={40} />
          <h3>Image तयार करता आली नाही, पुन्हा प्रयत्न करा</h3>
          <p>The AI could not generate the image. Please try again.</p>
          <button className="primary-btn" onClick={onRegenerate}><RefreshCw size={16} /> Retry</button>
        </div>
      ) : imageUrl ? (
        <div className="ai-preview-full">
          <div className="ai-preview-image-full">
            <img src={imageUrl} alt="Generated poster artwork" />
          </div>
          <div className="ai-preview-actions">
            <div className="ai-preview-prompt-box">
              <span className="ai-detail-label">Enhanced prompt</span>
              <p>{prompt || 'Your enhanced prompt will appear after generation.'}</p>
            </div>
            <div className="ai-preview-buttons">
              <button className="primary-btn ai-use-btn" onClick={onUseImage}><Check size={18} /> Use This Image</button>
              <button className="ghost-btn ai-regen-btn" onClick={onRegenerate}><RefreshCw size={16} /> Regenerate</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="ai-preview-placeholder">
          <ImageIcon size={48} />
          <p>Your generated image will appear here</p>
        </div>
      )}
    </div>
  );
}

type LayoutArea = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  font?: string;
  font_size?: number;
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  background?: string;
};

type FrameLayout = {
  image_area?: LayoutArea;
  logo_area?: LayoutArea;
  business_name_area?: LayoutArea;
  tagline_area?: LayoutArea;
  contact_row_area?: LayoutArea & { icons?: string[] };
  address_area?: LayoutArea;
  decorative?: {
    shape?: string;
    accent_color?: string;
    border_color?: string;
    background_color?: string;
    border_width?: number;
  };
};

function getArea(layout: FrameLayout, key: keyof FrameLayout): LayoutArea {
  return (layout[key] as LayoutArea | undefined) || {};
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, area: LayoutArea): void {
  const x = area.x || 0;
  const y = area.y || 0;
  const width = area.w || image.naturalWidth;
  const height = area.h || image.naturalHeight;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawText(ctx: CanvasRenderingContext2D, value: string, area: LayoutArea, defaultSize: number, weight = '400'): void {
  if (!value) return;
  const x = area.x || 0;
  const y = area.y || 0;
  const width = area.w || 0;
  const height = area.h || 0;
  const size = area.font_size || area.size || defaultSize;
  const align = area.align || 'left';
  ctx.font = `${weight} ${size}px ${area.font || 'Inter, Arial, sans-serif'}`;
  ctx.fillStyle = area.color || '#172238';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x;
  ctx.fillText(value, textX, y + height / 2, width || undefined);
}

function ComposeStep({ imageUrl, frame, frames, profile, exporting, onDownload, onCreateAnother, onFrameSelect, onRegenerate, onRendered }: {
  imageUrl: string;
  frame: PosterFrame;
  frames: PosterFrame[];
  profile: BusinessProfile | null;
  exporting: boolean;
  onDownload: (size: DownloadSize) => void;
  onCreateAnother: () => void;
  onFrameSelect: (frame: PosterFrame) => void;
  onRegenerate: () => void;
  onRendered: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = frame.layout_json as FrameLayout;
  const otherFrames = frames.filter(candidate => candidate.id !== frame.id);
  const address = [profile?.address, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ');
  const contactText = [profile?.phone, profile?.email, profile?.website].filter(Boolean).join('  •  ');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const render = async () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = frame.canvas_width;
      canvas.height = frame.canvas_height;
      const decorative = layout.decorative || {};
      context.fillStyle = decorative.background_color || '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = imageUrl;
      await new Promise<void>(resolve => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
      if (cancelled) return;
      if (image.naturalWidth) drawCoverImage(context, image, getArea(layout, 'image_area'));

      if (decorative.shape === 'rounded') {
        context.strokeStyle = decorative.border_color || profile?.primary_color || '#5648db';
        context.lineWidth = decorative.border_width || 8;
        context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, canvas.width - context.lineWidth, canvas.height - context.lineWidth);
      }
      const accent = decorative.accent_color || profile?.primary_color || '#5648db';
      context.fillStyle = accent;
      context.fillRect(0, Math.max(0, canvas.height - 14), canvas.width, 14);

      const logoArea = getArea(layout, 'logo_area');
      if (profile?.logo_url && logoArea.w && logoArea.h) {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.src = profile.logo_url;
        await new Promise<void>(resolve => {
          logo.onload = () => resolve();
          logo.onerror = () => resolve();
        });
        if (!cancelled && logo.naturalWidth) {
          const scale = Math.min((logoArea.w || 1) / logo.naturalWidth, (logoArea.h || 1) / logo.naturalHeight);
          const width = logo.naturalWidth * scale;
          const height = logo.naturalHeight * scale;
          context.drawImage(logo, (logoArea.x || 0) + ((logoArea.w || 0) - width) / 2, (logoArea.y || 0) + ((logoArea.h || 0) - height) / 2, width, height);
        }
      }
      drawText(context, profile?.business_name || 'Your Business', getArea(layout, 'business_name_area'), 34, '700');
      drawText(context, profile?.tagline || '', getArea(layout, 'tagline_area'), 22);
      drawText(context, contactText, getArea(layout, 'contact_row_area'), 18);
      drawText(context, address, getArea(layout, 'address_area'), 17);
      if (!cancelled) onRendered(canvas.toDataURL('image/png'));
    };
    void render();
    return () => { cancelled = true; };
  }, [frame, imageUrl, layout, onRendered, profile, address, contactText]);

  return (
    <div className="ai-wizard-step ai-compose-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Frame size={20} /></span><div><h2>Compose your poster</h2><p>Your business details are placed automatically from your current profile.</p></div></div>
      <div className="ai-canvas-wrap"><canvas ref={canvasRef} aria-label="Composed poster preview" /></div>
      <div className="ai-frame-switcher">
        <div className="ai-frame-switcher-heading"><strong>Try another frame</strong><span>Instant preview, no new image generation</span></div>
        <div className="ai-frame-strip">
          {otherFrames.map(candidate => (
            <button className="ai-frame-thumb-option" key={candidate.id} onClick={() => onFrameSelect(candidate)} type="button">
              <div className={`ai-frame-switch-thumb ${candidate.orientation}`}>
                {candidate.thumbnail_url ? <img src={candidate.thumbnail_url} alt={candidate.name} /> : <Frame size={20} />}
              </div>
              <span>{candidate.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ai-compose-actions">
        <button className="ghost-btn" onClick={onRegenerate} disabled={exporting}><RefreshCw size={16} /> Regenerate Image</button>
        <span className="ai-compose-ready"><Check size={15} /> Ready to download</span>
      </div>
      <div className="ai-final-action-bar">
        <label className="ai-export-select"><span>Export size</span><select defaultValue="full" onChange={event => onDownload(event.target.value as DownloadSize)} disabled={exporting}><option value="full">Full resolution ({frame.canvas_width}x{frame.canvas_height})</option><option value="instagram">Instagram Post (1080x1080)</option><option value="whatsapp">WhatsApp Status (1080x1920)</option><option value="facebook">Facebook Post (1200x630)</option></select><ChevronDown size={15} /></label>
        <button className="primary-btn" onClick={() => onDownload('full')} disabled={exporting}>{exporting ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Download size={16} /> Download</>}</button>
        <button className="ghost-btn" onClick={onCreateAnother} disabled={exporting}>Create Another</button>
      </div>
    </div>
  );
}

function DownloadStep({ imageUrl, exporting, onDownload }: { imageUrl: string; exporting: boolean; onDownload: (size: DownloadSize) => void }) {
  const download = () => onDownload('full');
  return (
    <div className="ai-wizard-step ai-download-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Download size={20} /></span><div><h2>Your poster is ready</h2><p>Download the composed poster and share it with your audience.</p></div></div>
      <div className="ai-download-preview">{imageUrl && <img src={imageUrl} alt="Final composed poster" />}</div>
      <button className="primary-btn ai-download-button" onClick={download} disabled={exporting}>{exporting ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Download size={18} /> Download Poster</>}</button>
    </div>
  );
}
