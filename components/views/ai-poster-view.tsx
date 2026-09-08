'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, Frame, Image as ImageIcon, Images, Loader2, RefreshCw, Share2, Sparkles, WandSparkles, Bot } from 'lucide-react';
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

type ImageProvider = 'gemini' | 'openai';

type DownloadSize = 'full' | 'instagram' | 'whatsapp' | 'facebook';

type WizardState = {
  category: PosterCategory | null;
  frame: PosterFrame | null;
  prompt: string;
  generatedImageUrl: string;
  enhancedPrompt: string;
  finalPosterUrl: string;
};

type PosterHistoryItem = {
  id: string;
  category_id: string | null;
  final_poster_url: string | null;
  generated_image_url: string | null;
  user_prompt: string;
  status: string;
  created_at: string;
  category_name: string | null;
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

const POSTER_PAGE_SIZE = 12;

export function AiPosterView() {
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
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
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState(30);
  const [history, setHistory] = useState<PosterHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [provider, setProvider] = useState<ImageProvider>('gemini');

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

  const loadUsage = useCallback(async () => {
    if (!companyId) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from('ai_posters')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['generated', 'composed', 'completed'])
      .gte('created_at', monthStart);
    setMonthlyUsage(count || 0);

    const { data: companyRow } = await supabase.from('companies').select('plan_id').eq('id', companyId).maybeSingle();
    const planId = companyRow?.plan_id || 'starter';
    const { data: featureRow } = await supabase.from('plan_feature_access').select('features').eq('plan_id', planId).maybeSingle();
    const features = featureRow?.features as Record<string, unknown> | null;
    const limit = (features?.ai_poster_monthly_limit as number) ?? 30;
    setMonthlyLimit(limit);
  }, [companyId]);

  useEffect(() => { void loadUsage(); }, [loadUsage]);

  const loadHistory = useCallback(async (page: number) => {
    if (!companyId) return;
    setHistoryLoading(true);
    const from = page * POSTER_PAGE_SIZE;
    const to = from + POSTER_PAGE_SIZE - 1;
    const [{ data, count }, catRes] = await Promise.all([
      supabase.from('ai_posters').select('id,final_poster_url,generated_image_url,user_prompt,status,created_at,category_id', { count: 'exact' }).eq('company_id', companyId).eq('status', 'completed').order('created_at', { ascending: false }).range(from, to),
      supabase.from('poster_categories').select('id,name'),
    ]);
    const catMap = new Map<string, string>((catRes.data || []).map(c => [c.id, c.name]));
    setHistory((data as PosterHistoryItem[] | null)?.map(item => ({ ...item, category_name: item.category_id ? catMap.get(item.category_id) || null : null })) || []);
    setHistoryTotal(count || 0);
    setHistoryPage(page);
    setHistoryLoading(false);
  }, [companyId]);

  useEffect(() => { if (activeTab === 'history') void loadHistory(0); }, [activeTab, loadHistory]);

  const visibleFrames = useMemo(() => {
    if (!wizard.category) return frames;
    return frames.filter(frame => !frame.category_id || frame.category_id === wizard.category?.id);
  }, [frames, wizard.category]);

  const updateWizard = (changes: Partial<WizardState>) => setWizard(current => ({ ...current, ...changes }));

  const limitReached = monthlyUsage >= monthlyLimit;

  const canContinue = [
    Boolean(wizard.category),
    Boolean(wizard.frame),
    wizard.prompt.trim().length >= 8 && !limitReached,
    Boolean(wizard.generatedImageUrl),
    Boolean(wizard.finalPosterUrl),
    Boolean(composedDataUrl),
  ][step - 1];

  const generatePoster = async (regenerate = false, onComplete?: () => void) => {
    if (!wizard.prompt.trim() || !wizard.frame || limitReached) return;
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
        provider,
      },
    });
    if (invokeError || !data?.image_url) {
      const limitMsg = typeof data?.error === 'string' && data.error.toLowerCase().includes('limit') || data?.monthly_limit != null;
      const serverError = typeof data?.error === 'string' ? data.error : '';
      const connectionError = invokeError?.message?.toLowerCase().includes('fetch') || invokeError?.message?.toLowerCase().includes('network')
        ? 'AI service शी connection होऊ शकले नाही. Internet connection किंवा Supabase Edge Function तपासा.'
        : invokeError?.message;
      setError(limitMsg
        ? 'महिन्याची AI poster limit पूर्ण झाली आहे. पुढच्या महिन्यात पुन्हा प्रयत्न करा.'
        : serverError || connectionError || 'Image तयार करता आली नाही. कृपया पुन्हा प्रयत्न करा.');
      setGenerating(false);
      return;
    }
    updateWizard({ generatedImageUrl: data.image_url, enhancedPrompt: data.enhanced_prompt || wizard.prompt.trim(), finalPosterUrl: '' });
    setPosterId(data.poster_id || '');
    setComposedDataUrl('');
    setGenerating(false);
    void loadUsage();
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
      void loadUsage();
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

  const downloadHistoryItem = async (item: PosterHistoryItem) => {
    const url = item.final_poster_url || item.generated_image_url;
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `poster-${item.id.slice(0, 8)}.png`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
      void handleDownload('full');
      return;
    }
    setStep(current => current + 1);
  };

  const back = () => {
    if (step > 1) setStep(current => current - 1);
  };

  const historyPageCount = Math.ceil(historyTotal / POSTER_PAGE_SIZE);

  return (
    <div className="ai-poster-client">
      <div className="ai-poster-tabs">
        <button className={`ai-poster-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')} type="button">
          <WandSparkles size={16} /> Create Poster
        </button>
        <button className={`ai-poster-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} type="button">
          <Images size={16} /> My Posters {historyTotal > 0 && <span className="ai-tab-badge">{historyTotal}</span>}
        </button>
      </div>

      {activeTab === 'history' ? (
        <HistoryTab
          history={history}
          loading={historyLoading}
          page={historyPage}
          pageCount={historyPageCount}
          onPageChange={loadHistory}
          onDownload={downloadHistoryItem}
        />
      ) : (
        <>
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
            {loading ? (
              <CreateSkeleton />
            ) : (
              <>
                <div key={step} className="ai-step-transition">
                  {step === 1 && <CategoryStep categories={categories} selected={wizard.category} onSelect={category => updateWizard({ category, frame: null })} />}
                  {step === 2 && <FrameStep frames={visibleFrames} selected={wizard.frame} onSelect={frame => updateWizard({ frame })} profile={businessProfile} />}
                  {step === 3 && <PromptStep prompt={wizard.prompt} onChange={prompt => updateWizard({ prompt })} category={wizard.category} monthlyUsage={monthlyUsage} monthlyLimit={monthlyLimit} limitReached={limitReached} provider={provider} onProviderChange={setProvider} />}
                  {step === 4 && <PreviewStep imageUrl={wizard.generatedImageUrl} prompt={wizard.enhancedPrompt} generating={generating} error={error} onRegenerate={() => generatePoster(true)} onUseImage={() => { composePoster(); setStep(5); }} />}
                  {step === 5 && wizard.frame && <ComposeStep imageUrl={wizard.finalPosterUrl || wizard.generatedImageUrl} frame={wizard.frame} frames={visibleFrames} profile={businessProfile} exporting={exporting} onDownload={handleDownload} onCreateAnother={resetWizard} onFrameSelect={frame => updateWizard({ frame })} onRegenerate={() => { setStep(4); void generatePoster(true, () => setStep(5)); }} onRendered={setComposedDataUrl} />}
                  {step === 6 && <DownloadStep imageUrl={composedDataUrl || wizard.finalPosterUrl || wizard.generatedImageUrl} exporting={exporting} onDownload={handleDownload} />}
                </div>

                {error && step !== 4 && <div className="ai-poster-error">{error}</div>}
                <div className="ai-poster-footer">
                  <button className="ghost-btn" onClick={back} disabled={step === 1}><ArrowLeft size={16} /> Back</button>
                  {step === 3 && limitReached ? (
                    <button className="primary-btn ai-upgrade-btn" onClick={() => setActiveTab('history')}>
                      <Sparkles size={16} /> Upgrade Plan
                    </button>
                  ) : (
                    <button className="primary-btn" onClick={next} disabled={!canContinue || generating}>
                      {step === 3 ? <><Sparkles size={16} /> Generate</> : step === 5 ? <><ArrowRight size={16} /> Next: Download</> : step === 6 ? <><Download size={16} /> Download Poster</> : <>Next <ArrowRight size={16} /></>}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {successUrl && (
        <div className="ai-poster-success-toast" role="status">
          <div><strong>पोस्टर तयार झाला! 🎉</strong><span>Your final poster is saved and ready to share.</span></div>
          <button className="ghost-btn" onClick={sharePoster}><Share2 size={15} /> Share on WhatsApp</button>
          <button className="ai-toast-close" onClick={() => setSuccessUrl('')} aria-label="Close">&times;</button>
        </div>
      )}
    </div>
  );
}

function CreateSkeleton() {
  return (
    <div className="ai-wizard-step">
      <div className="ai-skeleton-heading">
        <div className="ai-skeleton-icon" />
        <div className="ai-skeleton-text-group">
          <div className="ai-skeleton-line w-60" />
          <div className="ai-skeleton-line w-40" />
        </div>
      </div>
      <div className="ai-skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="ai-skeleton-card" key={i}>
            <div className="ai-skeleton-thumb" />
            <div className="ai-skeleton-line w-50" />
            <div className="ai-skeleton-line w-30" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ history, loading, page, pageCount, onPageChange, onDownload }: {
  history: PosterHistoryItem[];
  loading: boolean;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onDownload: (item: PosterHistoryItem) => void;
}) {
  return (
    <section className="panel ai-poster-panel">
      <div className="ai-step-heading">
        <span className="ai-heading-icon"><Images size={20} /></span>
        <div><h2>My Posters</h2><p>Your completed AI posters, newest first.</p></div>
      </div>
      {loading ? (
        <div className="ai-history-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="ai-skeleton-card" key={i}>
              <div className="ai-skeleton-thumb ai-skeleton-thumb-tall" />
              <div className="ai-skeleton-line w-50" />
              <div className="ai-skeleton-line w-30" />
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="ai-empty-state">
          <Images size={40} />
          <h3>No posters yet</h3>
          <p>Posters you create will appear here for easy re-download.</p>
        </div>
      ) : (
        <>
          <div className="ai-history-grid">
            {history.map(item => (
              <div className="ai-history-card" key={item.id}>
                <div className="ai-history-thumb">
                  {(item.final_poster_url || item.generated_image_url) ? (
                    <img src={item.final_poster_url || item.generated_image_url || ''} alt={item.user_prompt.slice(0, 40)} loading="lazy" />
                  ) : (
                    <ImageIcon size={28} />
                  )}
                </div>
                <div className="ai-history-info">
                  <strong>{item.category_name || 'Poster'}</strong>
                  <span>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <button className="ghost-btn ai-history-dl" onClick={() => onDownload(item)} type="button">
                  <Download size={14} /> Download Again
                </button>
              </div>
            ))}
          </div>
          {pageCount > 1 && (
            <div className="ai-history-pager">
              <button className="ghost-btn" disabled={page === 0} onClick={() => onPageChange(page - 1)} type="button"><ArrowLeft size={15} /> Prev</button>
              <span>Page {page + 1} of {pageCount}</span>
              <button className="ghost-btn" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)} type="button">Next <ArrowRight size={15} /></button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CategoryStep({ categories, selected, onSelect }: { categories: PosterCategory[]; selected: PosterCategory | null; onSelect: (category: PosterCategory) => void }) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Sparkles size={20} /></span><div><h2>What kind of poster are you creating?</h2><p>Choose a category to find the right visual direction.</p></div></div>
      {categories.length === 0 ? (
        <div className="ai-empty-state"><Sparkles size={34} /><h3>No categories yet</h3><p>New poster categories will appear here once they are configured.</p></div>
      ) : (
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
      )}
    </div>
  );
}

function FrameStep({ frames, selected, onSelect, profile }: { frames: PosterFrame[]; selected: PosterFrame | null; onSelect: (frame: PosterFrame) => void; profile: BusinessProfile | null }) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Frame size={20} /></span><div><h2>Choose a frame for your brand</h2><p>Each frame shows a live preview with your logo, business name, contact, and address.</p></div></div>
      {frames.length === 0 ? (
        <div className="ai-empty-state">
          <Frame size={40} />
          <h3>No frames yet</h3>
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
                  <FramePreviewCanvas frame={frame} profile={profile} />
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

function FramePreviewCanvas({ frame, profile }: { frame: PosterFrame; profile: BusinessProfile | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = frame.layout_json as FrameLayout;
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
      const imageArea = getArea(layout, 'image_area');
      context.fillStyle = '#e2e8f0';
      context.fillRect(imageArea.x || 0, imageArea.y || 0, imageArea.w || canvas.width, imageArea.h || Math.round(canvas.height * 0.56));
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
        await new Promise<void>(resolve => { logo.onload = () => resolve(); logo.onerror = () => resolve(); });
        if (!cancelled && logo.naturalWidth) {
          const scale = Math.min((logoArea.w || 1) / logo.naturalWidth, (logoArea.h || 1) / logo.naturalHeight);
          const width = logo.naturalWidth * scale;
          const height = logo.naturalHeight * scale;
          context.drawImage(logo, (logoArea.x || 0) + ((logoArea.w || 0) - width) / 2, (logoArea.y || 0) + ((logoArea.h || 0) - height) / 2, width, height);
        }
      } else if (logoArea.w && logoArea.h) {
        context.fillStyle = (decorative.accent_color || profile?.primary_color || '#5648db') + '22';
        context.beginPath();
        context.arc((logoArea.x || 0) + (logoArea.w || 0) / 2, (logoArea.y || 0) + (logoArea.h || 0) / 2, Math.min(logoArea.w || 40, logoArea.h || 40) / 2, 0, Math.PI * 2);
        context.fill();
      }
      drawText(context, profile?.business_name || 'Your Business', getArea(layout, 'business_name_area'), 34, '700');
      drawText(context, profile?.tagline || '', getArea(layout, 'tagline_area'), 22);
      drawText(context, contactText, getArea(layout, 'contact_row_area'), 18);
      drawText(context, address, getArea(layout, 'address_area'), 17);
    };
    void render();
    return () => { cancelled = true; };
  }, [frame, layout, profile, address, contactText]);

  return <canvas ref={canvasRef} className="ai-frame-preview-canvas" aria-label={`${frame.name} preview`} />;
}

function PromptStep({ prompt, onChange, category, monthlyUsage, monthlyLimit, limitReached, provider, onProviderChange }: {
  prompt: string;
  onChange: (value: string) => void;
  category: PosterCategory | null;
  monthlyUsage: number;
  monthlyLimit: number;
  limitReached: boolean;
  provider: ImageProvider;
  onProviderChange: (provider: ImageProvider) => void;
}) {
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
      <div className={`ai-usage-bar ${limitReached ? 'limit-reached' : ''}`}>
        <div className="ai-usage-text">
          {limitReached ? (
            <>You have reached your monthly limit of {monthlyLimit} posters. Upgrade your plan to create more.</>
          ) : (
            <>{monthlyUsage} / {monthlyLimit} AI poster generations used this month</>
          )}
        </div>
        <div className="ai-usage-track"><div className="ai-usage-fill" style={{ width: `${Math.min(100, (monthlyUsage / monthlyLimit) * 100)}%` }} /></div>
      </div>
      <label className="ai-prompt-label" htmlFor="poster-prompt-client">Your image prompt</label>
      <textarea
        id="poster-prompt-client"
        className="ai-prompt-input"
        value={prompt}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={800}
        disabled={limitReached}
      />
      <div className="ai-prompt-meta">
        <span>AI will create an image without text or logos.</span>
        <span>{prompt.length}/800</span>
      </div>
      {!limitReached && (
        <div className="ai-provider-selector">
          <label className="ai-provider-label"><Bot size={16} /> AI Provider</label>
          <div className="ai-provider-options">
            <button type="button" className={`ai-provider-chip ${provider === 'gemini' ? 'active' : ''}`} onClick={() => onProviderChange('gemini')}>
              <span className="ai-provider-chip-icon">G</span>
              <div><strong>Google Gemini</strong><small>Default · Fast generation</small></div>
            </button>
            <button type="button" className={`ai-provider-chip ${provider === 'openai' ? 'active' : ''}`} onClick={() => onProviderChange('openai')}>
              <span className="ai-provider-chip-icon">O</span>
              <div><strong>OpenAI GPT-Image-2</strong><small>High quality · Premium</small></div>
            </button>
          </div>
        </div>
      )}
      {!limitReached && (
        <div className="ai-quick-ideas">
          <span className="ai-quick-ideas-label">Quick ideas:</span>
          <div className="ai-idea-chips">
            {ideas.map((idea, index) => (
              <button key={index} className="ai-idea-chip" onClick={() => onChange(idea)} type="button">{idea}</button>
            ))}
          </div>
        </div>
      )}
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
          <h3>Image तयार करता आली नाही</h3>
          <p className="ai-generation-error-detail">कारण: {error}</p>
          <button className="primary-btn" onClick={onRegenerate}><RefreshCw size={16} /> पुन्हा प्रयत्न करा</button>
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
        <div className="ai-empty-state">
          <ImageIcon size={48} />
          <h3>Waiting for generation</h3>
          <p>Your generated image will appear here.</p>
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
      await new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve(); });
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
        await new Promise<void>(resolve => { logo.onload = () => resolve(); logo.onerror = () => resolve(); });
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
