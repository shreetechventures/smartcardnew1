'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Check, Download, Edit3, ImageIcon, Loader2, Plus, Sparkles, Trash2,
  Wand2, X, Type, Palette, QrCode, Layers, Upload, ChevronRight,
  RefreshCw, Copy, Image as ImageIcon2, Star, Settings2,
} from 'lucide-react';
import { supabase, type AiTemplate, type AiProject, type AiCreation, type BrandKit, type BusinessProfile, type AiPlannerResponse } from '@/lib/supabase';
import { useCompanyId } from '@/hooks/use-company-id';

type StudioMode = 'home' | 'create' | 'composer';
type AspectRatio = '4:5' | '1:1' | '9:16' | '16:9';

type Occasion = {
  id: string;
  name: string;
  slug: string;
  category: string;
};

type CreativeType = 'festival-greeting' | 'business-promotion' | 'product-showcase' | 'sale-offer' | 'event' | 'review-poster' | 'brand' | 'general';

const creativeTypes: { id: CreativeType; label: string; icon: string }[] = [
  { id: 'festival-greeting', label: 'Festival Greeting', icon: '🎉' },
  { id: 'business-promotion', label: 'Business Promotion', icon: '🏢' },
  { id: 'product-showcase', label: 'Product Showcase', icon: '📦' },
  { id: 'sale-offer', label: 'Sale / Offer', icon: '🏷️' },
  { id: 'event', label: 'Event', icon: '📅' },
  { id: 'review-poster', label: 'Review Poster', icon: '⭐' },
  { id: 'brand', label: 'Brand', icon: '🎨' },
  { id: 'general', label: 'General', icon: '✨' },
];

const aspectRatios: { id: AspectRatio; label: string; icon: string }[] = [
  { id: '4:5', label: 'Portrait', icon: '▕▔▏' },
  { id: '1:1', label: 'Square', icon: '□' },
  { id: '9:16', label: 'Story', icon: '▕▏' },
  { id: '16:9', label: 'Landscape', icon: '▔▔' },
];

const quickCreateOptions = [
  { label: 'Festival', icon: '🎉', prompt: 'Create a festival greeting poster' },
  { label: 'Offer', icon: '🏷️', prompt: 'Create a promotional offer poster' },
  { label: 'Product', icon: '📦', prompt: 'Create a product showcase poster' },
  { label: 'Review', icon: '⭐', prompt: 'Create a review collection poster' },
  { label: 'Event', icon: '📅', prompt: 'Create an event announcement poster' },
  { label: 'Brand', icon: '🎨', prompt: 'Create a brand awareness poster' },
];

export function AiStudioView() {
  const { companyId } = useCompanyId();
  const [mode, setMode] = useState<StudioMode>('home');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [creations, setCreations] = useState<AiCreation[]>([]);
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [userPrompt, setUserPrompt] = useState('');
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>('4:5');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [planning, setPlanning] = useState(false);
  const [plannerResponse, setPlannerResponse] = useState<AiPlannerResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AiTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<AiProject | null>(null);

  const [copy, setCopy] = useState({ headline: '', subheadline: '', offer_text: '', cta_text: 'Visit Now' });
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<string>('');
  const [selectedCreativeType, setSelectedCreativeType] = useState<CreativeType>('general');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  useEffect(() => {
    (async () => {
      const [bp, bk, tpl, cr, pr, occ] = await Promise.all([
        supabase.from('business_profile').select('*').maybeSingle(),
        supabase.from('brand_kits').select('*').maybeSingle(),
        supabase.from('ai_templates').select('*').order('sort_order', { ascending: true }),
        supabase.from('ai_creations').select('*').order('created_at', { ascending: false }).limit(12),
        supabase.from('ai_projects').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('creative_occasions').select('id, name, slug, category').order('sort_order', { ascending: true }),
      ]);
      setProfile(bp.data as BusinessProfile | null);
      setBrandKit(bk.data as BrandKit | null);
      setTemplates((tpl.data as AiTemplate[]) || []);
      setCreations((cr.data as AiCreation[]) || []);
      setProjects((pr.data as AiProject[]) || []);
      setOccasions((occ.data as Occasion[]) || []);
      setLoading(false);
    })();
  }, []);

  const callCreativePlanner = async () => {
    if (!userPrompt.trim()) {
      showToast('Enter a description of what you want to create');
      return;
    }
    setPlanning(true);
    setPlannerResponse(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-creative-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          user_prompt: userPrompt,
          creative_type: creativeTypes.find(ct => ct.id === selectedCreativeType)?.label,
          occasion_slug: selectedOccasion || undefined,
          business_profile: profile ? {
            business_name: profile.business_name,
            tagline: profile.tagline,
            about: profile.about,
            city: profile.city,
            website: profile.website,
            phone: profile.phone,
            email: profile.email,
          } : undefined,
          brand_kit: brandKit ? {
            primary_color: brandKit.primary_color,
            secondary_color: brandKit.secondary_color,
            preferred_style: brandKit.preferred_style,
            preferred_language: brandKit.preferred_language,
          } : undefined,
          language: selectedLanguage,
          aspect_ratio: selectedAspect,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Planning failed');
      }

      const data: AiPlannerResponse = await res.json();
      setPlannerResponse(data);
      setCopy(data.copy);

      // Auto-select recommended template
      const recommended = data.recommended_templates?.[0];
      if (recommended) {
        const match = templates.find(t => t.category === recommended);
        if (match) setSelectedTemplate(match);
      }

      setMode('create');
      showToast('Creative plan generated! Review and generate images.');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate creative plan');
    } finally {
      setPlanning(false);
    }
  };

  const generateImages = async (customPrompt?: string) => {
    const prompt = customPrompt || plannerResponse?.image_prompt || userPrompt;
    if (!prompt) {
      showToast('No image prompt available');
      return;
    }
    setGenerating(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: selectedAspect,
          operation: 'generate',
          company_id: companyId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Image generation failed');
      }

      const data = await res.json();
      if (data.image_url) {
        setGeneratedImages(prev => [...prev, data.image_url]);
        setActiveImage(data.image_url);
        showToast('Image generated successfully!');
      }
    } catch (err: any) {
      showToast(err.message || 'Image generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const generateConcepts = async () => {
    if (!plannerResponse?.concepts || plannerResponse.concepts.length === 0) {
      await generateImages();
      return;
    }
    setGenerating(true);
    const newImages: string[] = [];
    for (const concept of plannerResponse.concepts) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/ai-generate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            prompt: concept.image_prompt,
            aspect_ratio: selectedAspect,
            operation: 'generate',
            company_id: companyId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.image_url) newImages.push(data.image_url);
        }
      } catch {
        // continue to next concept
      }
    }
    setGeneratedImages(prev => [...prev, ...newImages]);
    if (newImages.length > 0) {
      setActiveImage(newImages[0]);
      showToast(`Generated ${newImages.length} concept images!`);
    } else {
      showToast('No images generated. Try again.');
    }
    setGenerating(false);
  };

  const saveCreation = async () => {
    if (!activeImage || !companyId) {
      showToast('Generate an image first');
      return;
    }
    try {
      const { data, error } = await supabase.from('ai_creations').insert({
        company_id: companyId,
        title: copy.headline || userPrompt.slice(0, 50),
        type: 'poster',
        image_url: activeImage,
        composition_data: {
          template: selectedTemplate?.name || 'custom',
          copy,
          aspect_ratio: selectedAspect,
          brief: plannerResponse?.creative_brief,
        },
        aspect_ratio: selectedAspect,
        language: selectedLanguage,
      }).select().single();

      if (error) throw error;

      setCreations(prev => [data as AiCreation, ...prev]);
      showToast('Creation saved to your gallery!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save creation');
    }
  };

  const deleteCreation = async (id: string) => {
    await supabase.from('ai_creations').delete().eq('id', id);
    setCreations(prev => prev.filter(c => c.id !== id));
    showToast('Creation deleted');
  };

  const saveBrandKit = async (kit: Partial<BrandKit>) => {
    if (!companyId) return;
    if (brandKit) {
      const { error } = await supabase.from('brand_kits').update({ ...kit, updated_at: new Date().toISOString() }).eq('id', brandKit.id);
      if (!error) {
        setBrandKit({ ...brandKit, ...kit } as BrandKit);
        showToast('Brand kit updated');
      }
    } else {
      const { data, error } = await supabase.from('brand_kits').insert({ ...kit, company_id: companyId }).select().single();
      if (!error && data) {
        setBrandKit(data as BrandKit);
        showToast('Brand kit created');
      }
    }
  };

  const resetStudio = () => {
    setMode('home');
    setUserPrompt('');
    setPlannerResponse(null);
    setSelectedTemplate(null);
    setGeneratedImages([]);
    setActiveImage(null);
    setCopy({ headline: '', subheadline: '', offer_text: '', cta_text: 'Visit Now' });
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloaded');
  };

  // ============================================================
  // HOME VIEW
  // ============================================================
  if (mode === 'home') {
    return (
      <>
        <div className="page-header">
          <div>
            <h2 className="page-title">AI Creative Studio</h2>
            <p className="page-subtitle">Generate AI-powered marketing creatives from your business profile</p>
          </div>
          <button className="ghost-btn" onClick={() => setShowBrandKit(true)}>
            <Palette size={16} /> Brand Kit
          </button>
        </div>

        <div className="ai-studio-hero">
          <div className="ai-studio-prompt-box">
            <Sparkles size={22} className="ai-studio-sparkle" />
            <h3>What do you want to create?</h3>
            <textarea
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              placeholder="e.g. Create a premium Diwali offer poster for my jewellery business..."
              rows={3}
              className="ai-studio-textarea"
            />
            <div className="ai-studio-prompt-controls">
              <div className="ai-studio-aspect-selector">
                {aspectRatios.map(ar => (
                  <button
                    key={ar.id}
                    className={`aspect-chip ${selectedAspect === ar.id ? 'active' : ''}`}
                    onClick={() => setSelectedAspect(ar.id)}
                  >
                    <span className="aspect-icon">{ar.icon}</span>
                    {ar.label}
                  </button>
                ))}
              </div>
              <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)} className="ai-studio-lang-select">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="gu">Gujarati</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="kn">Kannada</option>
                <option value="bn">Bengali</option>
                <option value="pa">Punjabi</option>
              </select>
            </div>
            <button className="primary-btn ai-studio-generate-btn" onClick={callCreativePlanner} disabled={planning}>
              {planning ? <><Loader2 size={18} className="spin" /> Planning your creative...</> : <><Sparkles size={18} /> Generate Creative</>}
            </button>
          </div>

          {/* Creative Type Selector */}
          <div className="ai-studio-type-selector">
            <h4>What are you creating?</h4>
            <div className="ai-type-chips">
              {creativeTypes.map(ct => (
                <button
                  key={ct.id}
                  className={`ai-type-chip ${selectedCreativeType === ct.id ? 'active' : ''}`}
                  onClick={() => setSelectedCreativeType(ct.id)}
                >
                  <span className="ai-type-icon">{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Occasion Selector */}
          {occasions.length > 0 && (
            <div className="ai-studio-occasion-selector">
              <h4>Select Occasion <span className="optional-tag">(optional — AI can auto-detect)</span></h4>
              <div className="ai-occasion-chips">
                <button
                  className={`ai-occasion-chip ${selectedOccasion === '' ? 'active' : ''}`}
                  onClick={() => setSelectedOccasion('')}
                >
                  Auto-detect
                </button>
                {occasions.map(occ => (
                  <button
                    key={occ.id}
                    className={`ai-occasion-chip ${selectedOccasion === occ.slug ? 'active' : ''}`}
                    onClick={() => setSelectedOccasion(occ.slug)}
                  >
                    {occ.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ai-studio-quick-create">
            <h4>Quick Create</h4>
            <div className="quick-create-chips">
              {quickCreateOptions.map(opt => (
                <button
                  key={opt.label}
                  className="quick-create-chip"
                  onClick={() => { setUserPrompt(opt.prompt); }}
                >
                  <span className="qc-icon">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {templates.length > 0 && (
          <div className="ai-studio-section">
            <h3 className="ai-studio-section-title">Templates</h3>
            <div className="ai-template-grid">
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  className="ai-template-card"
                  onClick={() => { setSelectedTemplate(tpl); setMode('composer'); }}
                >
                  <div className="ai-template-preview" style={{ background: `linear-gradient(135deg, ${brandKit?.primary_color || '#5648db'}, ${brandKit?.secondary_color || '#0ea5e9'})` }}>
                    <span className="ai-template-category">{tpl.category}</span>
                    <div className="ai-template-mock">
                      <div className="mock-img" />
                      <div className="mock-text-line w60" />
                      <div className="mock-text-line w40" />
                      <div className="mock-cta" />
                    </div>
                  </div>
                  <div className="ai-template-info">
                    <strong>{tpl.name}</strong>
                    <span>{tpl.aspect_ratio}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && creations.length > 0 && (
          <div className="ai-studio-section">
            <h3 className="ai-studio-section-title">Recent Creations</h3>
            <div className="ai-creations-grid">
              {creations.map(cr => (
                <div className="ai-creation-card" key={cr.id}>
                  <div className="ai-creation-img">
                    <img src={cr.image_url} alt={cr.title} />
                  </div>
                  <div className="ai-creation-info">
                    <strong>{cr.title}</strong>
                    <span>{new Date(cr.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <div className="ai-creation-actions">
                      <button className="ghost-btn sm" onClick={() => downloadImage(cr.image_url, cr.title)}><Download size={13} /></button>
                      <button className="ghost-btn sm danger" onClick={() => deleteCreation(cr.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && creations.length === 0 && projects.length === 0 && (
          <div className="empty-state">
            <ImageIcon size={48} />
            <h3>No creations yet</h3>
            <p>Describe what you want to create above and let AI do the rest.</p>
          </div>
        )}

        {showBrandKit && (
          <BrandKitModal
            brandKit={brandKit}
            profile={profile}
            onSave={saveBrandKit}
            onClose={() => setShowBrandKit(false)}
            showToast={showToast}
          />
        )}

        {toast && <div className="toast"><Check size={17} /> {toast}</div>}
      </>
    );
  }

  // ============================================================
  // CREATE VIEW (after planner returns)
  // ============================================================
  if (mode === 'create') {
    return (
      <>
        <div className="page-header">
          <div>
            <h2 className="page-title">Creative Plan</h2>
            <p className="page-subtitle">Review your AI-generated creative brief and generate visuals</p>
          </div>
          <button className="ghost-btn" onClick={resetStudio}><X size={16} /> Start Over</button>
        </div>

        <div className="ai-create-layout">
          <div className="ai-create-main">
            {/* Creative Brief */}
            {plannerResponse && (
              <div className="ai-brief-panel">
                <h3 className="ai-brief-title"><Sparkles size={18} /> Creative Brief</h3>
                <div className="ai-brief-tags">
                  {plannerResponse.creative_brief && Object.entries(plannerResponse.creative_brief).map(([key, val]) => (
                    val && (
                      <div className="ai-brief-tag" key={key}>
                        <span className="tag-key">{key.replace(/_/g, ' ')}</span>
                        <span className="tag-val">{String(val)}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Copy editor */}
            <div className="ai-copy-editor">
              <h3 className="ai-copy-title"><Type size={18} /> Copy & Text</h3>
              <div className="form-field">
                <label>Headline</label>
                <input value={copy.headline} onChange={e => setCopy({ ...copy, headline: e.target.value })} placeholder="Headline" />
              </div>
              <div className="form-field">
                <label>Subheadline</label>
                <input value={copy.subheadline} onChange={e => setCopy({ ...copy, subheadline: e.target.value })} placeholder="Subheadline" />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Offer Text</label>
                  <input value={copy.offer_text} onChange={e => setCopy({ ...copy, offer_text: e.target.value })} placeholder="e.g. 50% OFF" />
                </div>
                <div className="form-field">
                  <label>Call to Action</label>
                  <input value={copy.cta_text} onChange={e => setCopy({ ...copy, cta_text: e.target.value })} placeholder="e.g. Visit Now" />
                </div>
              </div>
            </div>

            {/* Template selection */}
            <div className="ai-template-select-section">
              <h3 className="ai-template-select-title"><Layers size={18} /> Template</h3>
              <div className="ai-template-select-grid">
                {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    className={`ai-template-select-card ${selectedTemplate?.id === tpl.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplate(tpl)}
                  >
                    <div className="ai-template-select-preview" style={{ background: `linear-gradient(135deg, ${brandKit?.primary_color || '#5648db'}, ${brandKit?.secondary_color || '#0ea5e9'})` }}>
                      <span>{tpl.category}</span>
                    </div>
                    <strong>{tpl.name}</strong>
                  </button>
                ))}
              </div>
            </div>

            {/* Image generation */}
            <div className="ai-generate-section">
              <div className="ai-generate-header">
                <h3><ImageIcon2 size={18} /> AI Visual Generation</h3>
                <div className="ai-generate-actions">
                  <button className="ghost-btn sm" onClick={() => generateImages()} disabled={generating}>
                    {generating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Single
                  </button>
                  <button className="primary-btn sm" onClick={generateConcepts} disabled={generating}>
                    {generating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} 4 Concepts
                  </button>
                </div>
              </div>

              {plannerResponse?.image_prompt && (
                <div className="ai-prompt-display">
                  <span className="ai-prompt-label">Image Prompt:</span>
                  <p>{plannerResponse.image_prompt}</p>
                </div>
              )}

              {generating && (
                <div className="ai-generating-state">
                  <Loader2 size={32} className="spin" />
                  <p>Generating your visual... This may take 10-20 seconds</p>
                </div>
              )}

              {generatedImages.length > 0 && (
                <div className="ai-generated-grid">
                  {generatedImages.map((img, idx) => (
                    <div
                      key={idx}
                      className={`ai-generated-thumb ${activeImage === img ? 'active' : ''}`}
                      onClick={() => setActiveImage(img)}
                    >
                      <img src={img} alt={`Generated ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Sidebar */}
          <div className="ai-create-sidebar">
            <h3 className="ai-preview-title">Live Preview</h3>
            <div className={`ai-preview-canvas ar-${selectedAspect.replace(':', 'x')}`}>
              {activeImage ? (
                <img src={activeImage} alt="Preview" className="ai-preview-img" />
              ) : (
                <div className="ai-preview-placeholder">
                  <ImageIcon size={40} />
                  <p>Generate an image to see preview</p>
                </div>
              )}
              {/* Overlay text layers */}
              <div className="ai-preview-overlay">
                {copy.headline && <div className="ai-preview-headline" style={{ color: '#fff' }}>{copy.headline}</div>}
                {copy.subheadline && <div className="ai-preview-subheadline" style={{ color: '#fff' }}>{copy.subheadline}</div>}
                {copy.offer_text && <div className="ai-preview-offer">{copy.offer_text}</div>}
                {copy.cta_text && <div className="ai-preview-cta" style={{ background: brandKit?.primary_color || '#5648db' }}>{copy.cta_text}</div>}
                {profile?.business_name && <div className="ai-preview-business">{profile.business_name}</div>}
              </div>
            </div>

            <div className="ai-preview-actions">
              <button className="primary-btn" onClick={saveCreation} disabled={!activeImage}>
                <Check size={16} /> Save to Gallery
              </button>
              {activeImage && (
                <button className="ghost-btn" onClick={() => downloadImage(activeImage, copy.headline || 'creative')}>
                  <Download size={16} /> Download
                </button>
              )}
              <button className="ghost-btn" onClick={() => setMode('composer')}>
                <Edit3 size={16} /> Open Composer
              </button>
            </div>
          </div>
        </div>

        {toast && <div className="toast"><Check size={17} /> {toast}</div>}
      </>
    );
  }

  // ============================================================
  // COMPOSER VIEW
  // ============================================================
  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Poster Composer</h2>
          <p className="page-subtitle">Fine-tune your creative with full control over every element</p>
        </div>
        <button className="ghost-btn" onClick={() => setMode('create')}><ChevronRight size={16} /> Back to Create</button>
      </div>

      <div className="ai-composer-layout">
        <div className="ai-composer-tools">
          <div className="composer-tool-section">
            <h4><Type size={15} /> Text</h4>
            <div className="form-field">
              <label>Headline</label>
              <input value={copy.headline} onChange={e => setCopy({ ...copy, headline: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Subheadline</label>
              <input value={copy.subheadline} onChange={e => setCopy({ ...copy, subheadline: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Offer Text</label>
              <input value={copy.offer_text} onChange={e => setCopy({ ...copy, offer_text: e.target.value })} />
            </div>
            <div className="form-field">
              <label>CTA</label>
              <input value={copy.cta_text} onChange={e => setCopy({ ...copy, cta_text: e.target.value })} />
            </div>
          </div>

          <div className="composer-tool-section">
            <h4><Palette size={15} /> Colors</h4>
            <div className="composer-color-row">
              <label>Primary</label>
              <input type="color" value={brandKit?.primary_color || '#5648db'} onChange={e => {
                if (brandKit) { setBrandKit({ ...brandKit, primary_color: e.target.value }); }
              }} className="color-input-sm" />
            </div>
            <div className="composer-color-row">
              <label>Secondary</label>
              <input type="color" value={brandKit?.secondary_color || '#0ea5e9'} onChange={e => {
                if (brandKit) { setBrandKit({ ...brandKit, secondary_color: e.target.value }); }
              }} className="color-input-sm" />
            </div>
          </div>

          <div className="composer-tool-section">
            <h4><ImageIcon2 size={15} /> Image</h4>
            {generatedImages.length > 0 ? (
              <div className="composer-image-list">
                {generatedImages.map((img, idx) => (
                  <button
                    key={idx}
                    className={`composer-image-option ${activeImage === img ? 'active' : ''}`}
                    onClick={() => setActiveImage(img)}
                  >
                    <img src={img} alt={`Option ${idx + 1}`} />
                  </button>
                ))}
              </div>
            ) : (
              <button className="ghost-btn sm full" onClick={() => setMode('create')}>
                <Plus size={14} /> Generate Images
              </button>
            )}
          </div>

          <div className="composer-tool-section">
            <h4><QrCode size={15} /> QR Code</h4>
            <div className="composer-qr-options">
              <button className="composer-qr-btn">SmartCard QR</button>
              <button className="composer-qr-btn">Review QR</button>
              <button className="composer-qr-btn">Website QR</button>
              <button className="composer-qr-btn">WhatsApp QR</button>
            </div>
          </div>

          <div className="composer-tool-section">
            <h4><Layers size={15} /> Template</h4>
            <select
              value={selectedTemplate?.id || ''}
              onChange={e => {
                const match = templates.find(t => t.id === e.target.value);
                setSelectedTemplate(match || null);
              }}
              className="composer-template-select"
            >
              <option value="">Custom (no template)</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="ai-composer-canvas-area">
          <div className={`ai-composer-canvas ar-${selectedAspect.replace(':', 'x')}`}>
            {activeImage && <img src={activeImage} alt="Background" className="ai-composer-bg" />}
            <div className="ai-composer-overlay">
              {copy.headline && (
                <div className="composer-layer" style={{ fontSize: '2.2em', fontWeight: 700, color: '#fff' }}>
                  {copy.headline}
                </div>
              )}
              {copy.subheadline && (
                <div className="composer-layer" style={{ fontSize: '1.1em', color: '#fff', opacity: 0.9 }}>
                  {copy.subheadline}
                </div>
              )}
              {copy.offer_text && (
                <div className="composer-layer" style={{ fontSize: '2.8em', fontWeight: 800, color: '#ef4444' }}>
                  {copy.offer_text}
                </div>
              )}
              {copy.cta_text && (
                <div className="composer-layer composer-cta" style={{ background: brandKit?.primary_color || '#5648db', color: '#fff' }}>
                  {copy.cta_text}
                </div>
              )}
              {profile?.business_name && (
                <div className="composer-layer" style={{ fontSize: '0.9em', color: '#fff', opacity: 0.7 }}>
                  {profile.business_name}
                </div>
              )}
            </div>
          </div>

          <div className="ai-composer-export-bar">
            <button className="primary-btn" onClick={saveCreation} disabled={!activeImage}>
              <Check size={16} /> Save Creation
            </button>
            {activeImage && (
              <button className="ghost-btn" onClick={() => downloadImage(activeImage, copy.headline || 'poster')}>
                <Download size={16} /> Download
              </button>
            )}
            <button className="ghost-btn" onClick={() => generateImages()} disabled={generating}>
              {generating ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Regenerate
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </>
  );
}

// ============================================================
// BRAND KIT MODAL
// ============================================================
function BrandKitModal({
  brandKit,
  profile,
  onSave,
  onClose,
  showToast,
}: {
  brandKit: BrandKit | null;
  profile: BusinessProfile | null;
  onSave: (kit: Partial<BrandKit>) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [primaryColor, setPrimaryColor] = useState(brandKit?.primary_color || profile?.primary_color || '#5648db');
  const [secondaryColor, setSecondaryColor] = useState(brandKit?.secondary_color || profile?.secondary_color || '#0ea5e9');
  const [accentColor, setAccentColor] = useState(brandKit?.accent_color || '#f59e0b');
  const [fontFamily, setFontFamily] = useState(brandKit?.font_family || 'Inter');
  const [preferredStyle, setPreferredStyle] = useState(brandKit?.preferred_style || 'professional');
  const [preferredLanguage, setPreferredLanguage] = useState(brandKit?.preferred_language || 'en');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    onSave({
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      font_family: fontFamily,
      preferred_style: preferredStyle,
      preferred_language: preferredLanguage,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Palette size={20} /> Brand Kit</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">Your brand kit ensures every creative follows your visual identity.</p>

          <div className="form-row">
            <div className="form-field">
              <label>Primary Color</label>
              <div className="color-picker-row">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="color-input" />
                <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Secondary Color</label>
              <div className="color-picker-row">
                <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="color-input" />
                <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Accent Color</label>
              <div className="color-picker-row">
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="color-input" />
                <input value={accentColor} onChange={e => setAccentColor(e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Font Family</label>
              <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                <option value="Inter">Inter (Modern)</option>
                <option value="Poppins">Poppins (Rounded)</option>
                <option value="Roboto">Roboto (Clean)</option>
                <option value="Playfair Display">Playfair Display (Elegant)</option>
                <option value="Montserrat">Montserrat (Bold)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Preferred Style</label>
              <select value={preferredStyle} onChange={e => setPreferredStyle(e.target.value)}>
                <option value="professional">Professional</option>
                <option value="luxury">Luxury</option>
                <option value="minimal">Minimal</option>
                <option value="vibrant">Vibrant</option>
                <option value="traditional">Traditional</option>
                <option value="cinematic">Cinematic</option>
              </select>
            </div>
            <div className="form-field">
              <label>Preferred Language</label>
              <select value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="gu">Gujarati</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="kn">Kannada</option>
                <option value="bn">Bengali</option>
                <option value="pa">Punjabi</option>
              </select>
            </div>
          </div>

          <div className="brand-kit-preview" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{profile?.business_name || 'Your Business'}</div>
            <div style={{ color: accentColor, fontSize: 14, marginTop: 4 }}>Brand Kit Preview</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : 'Save Brand Kit'}
          </button>
        </div>
      </div>
    </div>
  );
}
