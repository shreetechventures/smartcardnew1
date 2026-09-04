'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Star, Sparkles, ThumbsUp } from 'lucide-react';
import { supabase, type BusinessProfile } from '@/lib/supabase';

type Step = 'rating' | 'templates' | 'thankyou';

type RoutingRules = { positive: string; neutral: string; negative: string };

type ReviewTemplate = {
  id: string;
  name: string;
  body: string;
};

export function ReviewClient({ params }: { params: { slug: string } }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [routingRules, setRoutingRules] = useState<RoutingRules>({ positive: 'google', neutral: 'feedback', negative: 'feedback' });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('rating');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [aiReviews, setAiReviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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
    if (destination === 'feedback' || value < 4) {
      setStep('templates');
      generateAiReviews(value);
    } else {
      setStep('templates');
      generateAiReviews(value);
    }
  };

  const generateAiReviews = async (stars: number) => {
    setGenerating(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const prompt = `Write 3 different SEO-friendly Google review texts for a business called "${businessName}". The customer gave ${stars} stars. Each review should be 2-3 sentences, genuine, mention the business name naturally, and include words like "excellent service", "highly recommend", "professional". Write each review on a separate line prefixed with "---". Write only the reviews, nothing else.`;

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-review-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          review_id: 'temp-' + Date.now(),
          reviewer_name: 'Customer',
          rating: stars,
          comment: '',
          business_name: businessName,
          custom_prompt: prompt,
        }),
      });

      if (!res.ok) throw new Error('AI generation failed');
      const data = await res.json();
      const text = data.reply || '';
      const reviews = text.split('---').map((r: string) => r.trim()).filter((r: string) => r.length > 10);
      setAiReviews(reviews.length > 0 ? reviews : [text]);
    } catch {
      setAiReviews([
        `I had an excellent experience with ${businessName}. The service was professional and the staff was very helpful. Highly recommend to anyone looking for quality service!`,
        `${businessName} provided outstanding service. Everything was handled professionally and efficiently. I will definitely be coming back and recommending them to friends and family.`,
        `Fantastic experience with ${businessName}! The team is knowledgeable, friendly, and truly cares about customer satisfaction. One of the best service experiences I've had.`,
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    window.setTimeout(() => setCopiedIdx(null), 2000);
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
        <div className="cr-footer">
          <span>Powered by TheSmartCard</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cr-page" style={profile?.review_background_color ? { background: profile.review_background_color } : undefined}>
      <div className="cr-card">
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
            <div className="cr-emoji"><ThumbsUp size={40} /></div>
            <h2>Thank you for the {rating}-star rating!</h2>
            <p className="cr-subtitle">Pick a message below, copy it, and paste it on {platformLabels[getDestination(rating)] || 'Google'} when you leave your review.</p>

            {generating && (
              <div className="cr-generating">
                <Loader2 size={24} className="spin" />
                <span>Generating review messages for you...</span>
              </div>
            )}

            {!generating && templates.length > 0 && (
              <>
                <h3 className="cr-template-section-title">Your Templates</h3>
                <div className="cr-ai-reviews">
                  {templates.map((tpl, idx) => (
                    <div className="cr-ai-review-card" key={tpl.id}>
                      <div className="cr-ai-review-header">
                        <Copy size={14} />
                        <span>{tpl.name}</span>
                      </div>
                      <p>{tpl.body}</p>
                      <button
                        className="cr-copy-btn"
                        onClick={() => copyText(tpl.body, tpl.id)}
                      >
                        {copiedIdx === tpl.id ? (
                          <><Check size={14} /> Copied!</>
                        ) : (
                          <><Copy size={14} /> Copy</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!generating && aiReviews.length > 0 && (
              <>
                <h3 className="cr-template-section-title"><Sparkles size={14} /> AI-Generated Messages</h3>
                <div className="cr-ai-reviews">
                  {aiReviews.map((review, idx) => (
                    <div className="cr-ai-review-card" key={`ai-${idx}`}>
                      <div className="cr-ai-review-header">
                        <Sparkles size={14} />
                        <span>AI-Generated Review</span>
                      </div>
                      <p>{review}</p>
                      <button
                        className="cr-copy-btn"
                        onClick={() => copyText(review, `ai-${idx}`)}
                      >
                        {copiedIdx === `ai-${idx}` ? (
                          <><Check size={14} /> Copied!</>
                        ) : (
                          <><Copy size={14} /> Copy</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </>
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

      <div className="cr-footer">
        <span>Powered by TheSmartCard</span>
      </div>
    </div>
  );
}
