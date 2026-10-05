'use client';

import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Star, Sparkles, ThumbsUp, RefreshCw, PenLine } from 'lucide-react';
import { supabase, type BusinessProfile } from '@/lib/supabase';
import { PoweredByFooter } from '@/components/powered-by-footer';

type Step = 'rating' | 'templates' | 'thankyou';

type RoutingRules = { positive: string; neutral: string; negative: string };

type ReviewTemplate = {
  id: string;
  name: string;
  body: string;
};

type AiReview = {
  id: string | null;
  content: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('review_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('review_session_id', id);
  }
  return id;
}

export function ReviewClient({ params }: { params: { slug: string } }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [routingRules, setRoutingRules] = useState<RoutingRules>({ positive: 'google', neutral: 'feedback', negative: 'feedback' });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('rating');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [aiReviews, setAiReviews] = useState<AiReview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [selectedReview, setSelectedReview] = useState<string>('');
  const [editingReview, setEditingReview] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [consumingId, setConsumingId] = useState(false);
  const sessionIdRef = useRef('');
  sessionIdRef.current = sessionId;

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        fetch(`${SUPABASE_URL}/functions/v1/ai-review-consume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ action: 'release', session_id: sessionIdRef.current }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data: profileData } = await supabase
        .from('business_profile')
        .select('*')
        .eq('review_slug', params.slug)
        .maybeSingle();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = profileData as BusinessProfile;
      setProfile(profile);

      const companyId = (profileData as any)?.company_id;

      const routingQuery = companyId
        ? supabase.from('review_routing_rules').select('*').eq('company_id', companyId).maybeSingle()
        : supabase.from('review_routing_rules').select('*').limit(1).maybeSingle();
      const { data: routingData } = await routingQuery;
      if (routingData) {
        setRoutingRules(routingData as RoutingRules);
      }

      const { data: tplData } = await supabase
        .from('review_templates')
        .select('id, name, body')
        .eq('company_id', companyId || '')
        .order('created_at', { ascending: false });
      if (tplData) setTemplates(tplData as ReviewTemplate[]);

      setLoading(false);
    })();
  }, [params.slug]);

  const businessName = profile?.business_name || 'Our Business';
  const googleLink = profile?.google_business || '';
  const logoUrl = profile?.logo_url;
  const heading = profile?.review_heading || 'How was your experience?';
  const subheading = profile?.review_subheading || 'Your feedback helps us serve you better';
  const thankYouMessage = profile?.review_thank_you_message;

  const getDestination = (value: number): string => {
    if (value >= 4) return routingRules.positive;
    if (value === 3) return routingRules.neutral;
    return routingRules.negative;
  };

  const platformLinks: Record<string, string | null> = {
    google: googleLink || null,
    facebook: profile?.facebook ? `https://facebook.com/${profile.facebook}` : null,
    justdial: null,
    feedback: null,
  };

  const platformLabels: Record<string, string> = {
    google: 'Google Reviews',
    facebook: 'Facebook Reviews',
    justdial: 'Justdial',
    feedback: 'Private Feedback',
  };

  const handleRating = (value: number) => {
    setRating(value);
    const destination = getDestination(value);
    if (destination === 'feedback') {
      const link = platformLinks[destination];
      if (link) window.open(link, '_blank');
      setStep('thankyou');
      return;
    }
    setStep('templates');
    generateAiReviews(value);
  };

  const generateAiReviews = async (stars: number, isRegen = false) => {
    if (isRegen) {
      setRegenerating(true);
    } else {
      setGenerating(true);
    }
    setAiError(false);

    if (sessionId) {
      fetch(`${SUPABASE_URL}/functions/v1/ai-review-consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: 'release', session_id: sessionId }),
      }).catch(() => {});
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-review-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          company_id: (profile as any)?.company_id,
          rating: stars,
          customer_experience: [],
          customer_comment: '',
          business_profile: {
            business_name: profile?.business_name,
            about: profile?.about,
            tagline: profile?.tagline,
            address: profile?.address,
            city: profile?.city,
            state: profile?.state,
            website: profile?.website,
            phone: profile?.phone,
          },
          session_id: sessionId,
        }),
      });

      if (!res.ok) throw new Error('AI generation failed');
      const data = await res.json();
      const reviews: AiReview[] = (data.reviews || []).map((r: any) => ({
        id: r.id || null,
        content: r.content || r,
      }));
      if (reviews.length === 0) throw new Error('No reviews returned');

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        sessionStorage.setItem('review_session_id', data.session_id);
      }

      setAiReviews(reviews);
    } catch {
      setAiError(true);
      setAiReviews([]);
    } finally {
      setGenerating(false);
      setRegenerating(false);
    }
  };

  const regenerate = () => {
    generateAiReviews(rating, true);
  };

  const copyText = async (text: string, id: string, reviewId?: string | null) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(id);

      if (reviewId) {
        setConsumingId(true);
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/ai-review-consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ action: 'consume', review_id: reviewId, session_id: sessionId }),
          });
        } catch {
        } finally {
          setConsumingId(false);
        }
      }

      window.setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
    }
  };

  const useReview = (text: string) => {
    setSelectedReview(text);
    setEditDraft(text);
    setEditingReview(true);
  };

  const goToPlatform = () => {
    const destination = getDestination(rating);
    const link = platformLinks[destination];
    if (link) {
      window.open(link, '_blank');
    }
    setStep('thankyou');
  };

  if (loading) {
    return (
      <div className="cr-page">
        <div className="cr-card">
          <div className="cr-loading"><Loader2 size={32} className="spin" /></div>
        </div>
        <PoweredByFooter />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="cr-page">
        <div className="cr-card">
          <div className="cr-step cr-thankyou">
            <div className="cr-emoji cr-emoji-sad"><ThumbsUp size={48} /></div>
            <h2>Business not found</h2>
            <p className="cr-subtitle">We couldn&apos;t find a business at this link. Please check the URL and try again.</p>
          </div>
        </div>
        <PoweredByFooter />
      </div>
    );
  }

  return (
    <div className="cr-page" style={profile?.review_background_color ? { background: profile.review_background_color } : undefined}>
      <div className="cr-card">
        <button className="cr-back-btn" onClick={() => {
          if (step === 'templates' && !editingReview) { setStep('rating'); }
          else if (step === 'templates' && editingReview) { setEditingReview(false); }
          else { window.history.back(); }
        }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="cr-header">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="cr-logo" />
          ) : (
            <div className="cr-logo-placeholder">{businessName.charAt(0).toUpperCase()}</div>
          )}
          <h1>{businessName}</h1>
          {profile?.tagline && <p>{profile.tagline}</p>}
        </div>

        {step === 'rating' && (
          <div className="cr-step">
            <h2>{heading}</h2>
            <p className="cr-subtitle">{subheading}</p>
            <div className="cr-stars">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  onClick={() => handleRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`${i} stars`}
                >
                  <Star
                    size={48}
                    className={i <= (hoverRating || rating) ? 'cr-star-filled' : 'cr-star-empty'}
                    fill={i <= (hoverRating || rating) ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
            <div className="cr-rating-labels">
              <span>Bad</span>
              <span>Good</span>
              <span>Great</span>
            </div>
          </div>
        )}

        {step === 'templates' && (
          <div className="cr-step">
            {!editingReview ? (
              <>
                <div className="cr-emoji"><ThumbsUp size={40} /></div>
                <h2>Choose Your Review</h2>
                <p className="cr-subtitle">Pick a message below, copy it, and paste it on {platformLabels[getDestination(rating)] || 'Google'} when you leave your review.</p>

                {/* AI-Generated Reviews Section */}
                <h3 className="cr-template-section-title"><Sparkles size={14} /> AI Personalized Reviews</h3>

                {(generating || regenerating) && (
                  <div className="cr-generating">
                    <Loader2 size={24} className="spin" />
                    <span>{regenerating ? 'Generating fresh suggestions...' : 'Creating personalized suggestions for you...'}</span>
                  </div>
                )}

                {aiError && !generating && !regenerating && (
                  <div className="cr-ai-error">
                    <p>Unable to generate personalized suggestions right now.</p>
                    <button className="cr-regenerate-btn" onClick={regenerate}>
                      <RefreshCw size={14} /> Try Again
                    </button>
                  </div>
                )}

                {!generating && !regenerating && !aiError && aiReviews.length > 0 && (
                  <>
                    <div className="cr-ai-reviews">
                      {aiReviews.map((review, idx) => (
                        <div className="cr-ai-review-card" key={review.id || `ai-${idx}`}>
                          <div className="cr-ai-review-header">
                            <Sparkles size={14} />
                            <span>AI-Generated Review {idx + 1}</span>
                          </div>
                          <p>{review.content}</p>
                          <div className="cr-review-actions">
                            <button
                              className="cr-copy-btn"
                              onClick={() => copyText(review.content, `ai-${idx}`, review.id)}
                              disabled={consumingId}
                            >
                              {consumingId && copiedIdx === `ai-${idx}`
                                ? <><Loader2 size={14} className="spin" /> Claiming...</>
                                : copiedIdx === `ai-${idx}`
                                  ? <><Check size={14} /> Copied!</>
                                  : <><Copy size={14} /> Copy</>}
                            </button>
                            <button className="cr-use-btn" onClick={() => useReview(review.content)}>
                              <PenLine size={14} /> Use &amp; Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="cr-regenerate-btn" onClick={regenerate} disabled={regenerating}>
                      {regenerating ? <><Loader2 size={14} className="spin" /> Generating...</> : <><RefreshCw size={14} /> Generate 3 New Reviews</>}
                    </button>
                  </>
                )}

                {/* Manual Templates Section */}
                {templates.length > 0 && (
                  <>
                    <h3 className="cr-template-section-title cr-manual-section-title">Saved Business Templates</h3>
                    <div className="cr-ai-reviews">
                      {templates.map((tpl) => (
                        <div className="cr-ai-review-card cr-manual-card" key={tpl.id}>
                          <div className="cr-ai-review-header">
                            <Copy size={14} />
                            <span>{tpl.name}</span>
                          </div>
                          <p>{tpl.body}</p>
                          <div className="cr-review-actions">
                            <button className="cr-copy-btn" onClick={() => copyText(tpl.body, tpl.id)}>
                              {copiedIdx === tpl.id ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                            </button>
                            <button className="cr-use-btn" onClick={() => useReview(tpl.body)}>
                              <PenLine size={14} /> Use &amp; Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Manual write option when AI fails */}
                {aiError && templates.length === 0 && (
                  <div className="cr-manual-write-section">
                    <h3 className="cr-template-section-title">Write Your Own Review</h3>
                    <p className="cr-subtitle">You can write your own review and copy it to paste on {platformLabels[getDestination(rating)] || 'Google'}.</p>
                    <textarea
                      className="cr-manual-textarea"
                      placeholder="Write your review here..."
                      rows={4}
                      onChange={e => setSelectedReview(e.target.value)}
                    />
                    <button className="cr-copy-btn" onClick={() => copyText(selectedReview, 'manual')}>
                      {copiedIdx === 'manual' ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy My Review</>}
                    </button>
                  </div>
                )}

                <div className="cr-positive-actions">
                  {platformLinks[getDestination(rating)] && (
                    <button className="cr-google-btn" onClick={goToPlatform}>
                      <ExternalLink size={18} /> Go to {platformLabels[getDestination(rating)]} &amp; Paste
                    </button>
                  )}
                  <button className="cr-skip-btn" onClick={() => setStep('thankyou')}>
                    Done
                  </button>
                </div>

                <div className="cr-instructions">
                  <strong>How it works:</strong>
                  <ol>
                    <li>Copy one of the messages above</li>
                    <li>Click &quot;Go to {platformLabels[getDestination(rating)] || 'Google'}&quot;</li>
                    <li>Paste the message and submit your review</li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                {/* Edit Review Step */}
                <div className="cr-emoji"><PenLine size={40} /></div>
                <h2>Edit Your Review</h2>
                <p className="cr-subtitle">Make any changes before copying and pasting on {platformLabels[getDestination(rating)] || 'Google'}.</p>

                <textarea
                  className="cr-edit-review-textarea"
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  rows={6}
                />

                <div className="cr-edit-actions">
                  <button className="cr-copy-btn" onClick={() => copyText(editDraft, 'edited')}>
                    {copiedIdx === 'edited' ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Review</>}
                  </button>
                  <button className="cr-skip-btn" onClick={() => setEditingReview(false)}>
                    Back to Options
                  </button>
                </div>

                <div className="cr-positive-actions">
                  {platformLinks[getDestination(rating)] && (
                    <button className="cr-google-btn" onClick={goToPlatform}>
                      <ExternalLink size={18} /> Go to {platformLabels[getDestination(rating)]} &amp; Paste
                    </button>
                  )}
                  <button className="cr-skip-btn" onClick={() => setStep('thankyou')}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'thankyou' && (
          <div className="cr-step cr-thankyou">
            <div className="cr-emoji cr-emoji-happy"><Check size={48} /></div>
            <h2>Thank you!</h2>
            <p className="cr-subtitle">
              {thankYouMessage || 'Thank you for taking the time to share your experience. Your review means the world to us!'}
            </p>
            <button className="cr-done-btn" onClick={() => window.close()}>
              Done
            </button>
          </div>
        )}
      </div>

      <PoweredByFooter />
    </div>
  );
}
