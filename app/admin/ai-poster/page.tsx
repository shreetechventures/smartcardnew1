'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Image as ImageIcon, Loader2, Sparkles, WandSparkles, Frame } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  { label: 'Compose & Download', short: 'Download' },
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

export default function AiPosterPage() {
  const router = useRouter();
  const { companyId } = useAuth();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<PosterCategory[]>([]);
  const [frames, setFrames] = useState<PosterFrame[]>([]);
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
      const [categoryRes, frameRes] = await Promise.all([
        supabase.from('poster_categories').select('id,name,name_local,icon').eq('is_active', true).order('sort_order'),
        supabase.from('poster_frames').select('id,category_id,name,thumbnail_url,orientation,canvas_width,canvas_height,layout_json').eq('is_active', true).order('created_at'),
      ]);
      if (!mounted) return;
      if (categoryRes.error || frameRes.error) setError('The poster catalog could not be loaded.');
      setCategories((categoryRes.data as PosterCategory[]) || []);
      setFrames((frameRes.data as PosterFrame[]) || []);
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
  ][step - 1];

  const generatePoster = async () => {
    if (!wizard.prompt.trim() || !wizard.frame) return;
    setGenerating(true);
    setError('');
    const aspectRatio = wizard.frame.orientation === 'square' ? '1:1' : wizard.frame.orientation === 'story' ? '9:16' : wizard.frame.orientation === 'landscape' ? '16:9' : '4:5';
    const { data, error: invokeError } = await supabase.functions.invoke('ai-generate-image', {
      body: { prompt: wizard.prompt.trim(), aspect_ratio: aspectRatio, company_id: companyId || undefined },
    });
    if (invokeError || !data?.image_url) {
      setError('The image could not be generated. Please try again.');
      setGenerating(false);
      return;
    }
    updateWizard({ generatedImageUrl: data.image_url, enhancedPrompt: data.prompt || wizard.prompt.trim() });
    if (companyId && wizard.category && wizard.frame) {
      await supabase.from('ai_posters').insert({
        company_id: companyId,
        category_id: wizard.category.id,
        frame_id: wizard.frame.id,
        user_prompt: wizard.prompt.trim(),
        enhanced_prompt: data.prompt || wizard.prompt.trim(),
        generated_image_url: data.image_url,
        status: 'generated',
      });
    }
    setGenerating(false);
  };

  const composePoster = () => {
    if (!wizard.generatedImageUrl) return;
    updateWizard({ finalPosterUrl: wizard.generatedImageUrl });
  };

  const next = () => {
    if (step === 3) {
      setStep(4);
      if (!wizard.generatedImageUrl) void generatePoster();
      return;
    }
    if (step === 4 && !wizard.finalPosterUrl) composePoster();
    if (step === 5) {
      const link = document.createElement('a');
      link.href = wizard.finalPosterUrl || wizard.generatedImageUrl;
      link.download = 'thesmartcard-ai-poster.png';
      link.click();
      return;
    }
    setStep(current => current + 1);
  };

  const back = () => {
    if (step === 1) router.push('/admin');
    else setStep(current => current - 1);
  };

  return (
    <div className="app-shell admin-shell ai-poster-shell">
      <main className="main-content ai-poster-main">
        <header className="topbar ai-poster-topbar">
          <button className="ghost-btn" onClick={() => router.push('/admin')}><ArrowLeft size={16} /> Admin Dashboard</button>
          <div className="welcome"><h1>AI Poster Studio</h1><p>Create branded social posters in a few simple steps</p></div>
        </header>
        <div className="page-content ai-poster-content">
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
                {step === 4 && <PreviewStep imageUrl={wizard.generatedImageUrl} prompt={wizard.enhancedPrompt} generating={generating} error={error} onGenerate={generatePoster} />}
                {step === 5 && <ComposeStep imageUrl={wizard.finalPosterUrl || wizard.generatedImageUrl} frame={wizard.frame} onCompose={composePoster} />}

                {error && step !== 4 && <div className="ai-poster-error">{error}</div>}
                <div className="ai-poster-footer">
                  <button className="ghost-btn" onClick={back}><ArrowLeft size={16} /> Back</button>
                  <button className="primary-btn" onClick={next} disabled={!canContinue || generating}>
                    {step === 5 ? <><Download size={16} /> Download Poster</> : < >Next <ArrowRight size={16} /></>}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
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
            <button
              className={`ai-category-chip ${isSelected ? 'selected' : ''}`}
              key={category.id}
              onClick={() => onSelect(category)}
              role="tab"
              aria-selected={isSelected}
            >
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
              <button
                className={`ai-frame-card ${isSelected ? 'selected' : ''}`}
                key={frame.id}
                onClick={() => onSelect(frame)}
                role="radio"
                aria-checked={isSelected}
              >
                {isSelected && <span className="ai-frame-check"><Check size={16} /></span>}
                <div className={`ai-frame-thumb ${frame.orientation}`}>
                  {frame.thumbnail_url ? <img src={frame.thumbnail_url} alt={frame.name} /> : <><ImageIcon size={30} /><span>{orientationLabels[frame.orientation] || frame.orientation}</span></>}
                  <span className={orientationBadgeClass[frame.orientation] || 'ai-orient-badge'}>{orientationLabels[frame.orientation] || frame.orientation}</span>
                </div>
                <div className="ai-frame-info">
                  <strong>{frame.name}</strong>
                  <small>{frame.canvas_width} × {frame.canvas_height}</small>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptStep({ prompt, onChange, category }: { prompt: string; onChange: (value: string) => void; category: PosterCategory | null }) {
  return (
    <div className="ai-wizard-step ai-prompt-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><WandSparkles size={20} /></span><div><h2>Describe the image you want</h2><p>Be specific about the subject, mood, colors, and setting. Text and business details are added in the frame.</p></div></div>
      <label className="ai-prompt-label" htmlFor="poster-prompt">Your image prompt</label>
      <textarea id="poster-prompt" className="ai-prompt-input" value={prompt} onChange={event => onChange(event.target.value)} placeholder={`Example: A warm ${category?.name.toLowerCase() || 'business'} scene with golden light, elegant flowers, and a premium editorial style`} maxLength={800} />
      <div className="ai-prompt-meta"><span>AI will create an image without text or logos.</span><span>{prompt.length}/800</span></div>
    </div>
  );
}

function PreviewStep({ imageUrl, prompt, generating, error, onGenerate }: { imageUrl: string; prompt: string; generating: boolean; error: string; onGenerate: () => void }) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Sparkles size={20} /></span><div><h2>Review your generated image</h2><p>Generate again if you want a different creative direction.</p></div></div>
      <div className="ai-preview-layout">
        <div className="ai-preview-image">{generating ? <><Loader2 size={34} className="spin" /><span>Creating your image...</span></> : imageUrl ? <img src={imageUrl} alt="Generated poster artwork" /> : <><ImageIcon size={38} /><span>Your preview will appear here</span></>}</div>
        <div className="ai-preview-details"><span className="ai-detail-label">Enhanced prompt</span><p>{prompt || 'Your enhanced prompt will appear after generation.'}</p><button className="ghost-btn" onClick={onGenerate} disabled={generating}><Sparkles size={16} /> Generate Again</button></div>
      </div>
      {error && <div className="ai-poster-error">{error}</div>}
    </div>
  );
}

function ComposeStep({ imageUrl, frame, onCompose }: { imageUrl: string; frame: PosterFrame | null; onCompose: () => void }) {
  return (
    <div className="ai-wizard-step">
      <div className="ai-step-heading"><span className="ai-heading-icon"><Download size={20} /></span><div><h2>Compose and download</h2><p>Your artwork is ready to be placed inside the selected business frame.</p></div></div>
      <div className="ai-compose-layout">
        <div className={`ai-compose-preview ${frame?.orientation || 'portrait'}`}>{imageUrl && <img src={imageUrl} alt="Final poster preview" />}{frame && <div className="ai-compose-overlay"><strong>Your Business Name</strong><span>Contact details will appear here</span></div>}</div>
        <div className="ai-compose-copy"><span className="ai-success-badge"><Check size={14} /> Artwork ready</span><h3>{frame?.name || 'Selected frame'}</h3><p>Click compose to prepare the final poster, then use the download button to save it.</p><button className="ghost-btn" onClick={onCompose}><Check size={16} /> Compose Poster</button></div>
      </div>
    </div>
  );
}
