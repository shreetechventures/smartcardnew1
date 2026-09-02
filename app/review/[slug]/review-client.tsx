'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Heart, Loader2, Send, Star, Sparkles, ThumbsUp } from 'lucide-react';
import { supabase, type BusinessProfile } from '@/lib/supabase';

type Step = 'rating' | 'positive' | 'feedback' | 'thankyou';

type RoutingRules = { positive: string; neutral: string; negative: string };

export function ReviewClient({ params }: { params: { slug: string } }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [routingRules, setRoutingRules] = useState<RoutingRules>({ positive: 'google', neutral: 'feedback', negative: 'feedback' });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('rating');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiReviews, setAiReviews] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: profileData } = await supabase.from('business_profile').select('*').eq('review_slug', params.slug).maybeSingle();
      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(profileData as BusinessProfile | null);
      const companyId = (profileData as any)?.company_id;
      const routingQuery = companyId
        ? supabase.from('review_routing_rules').select('*').eq('company_id', companyId).maybeSingle()
        : supabase.from('review_routing_rules').select('*').limit(1).maybeSingle();
      const { data: routingData } = await routingQuery;
      if (routingData) {
        setRoutingRules(routingData as RoutingRules);
      }
      setLoading(false);
    })();
  }, [params.slug]);

  const businessName = profile?.business_name || 'Our Business';
  const googleLink = profile?.google_business || '';
  const logoUrl = profile?.logo_url;

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
    if (destination === 'feedback' || (value < 4 && destination !== 'google' && destination !== 'facebook' && destination !== 'justdial')) {
      setStep('feedback');
    } else {
      setStep('positive');
      generateAiReviews(value);
    }
  };

  const generateAiReviews = async (stars: number) => {
    setGenerating(true);
    setError('');
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const prompt = `Write 3 different SEO-friendly Google review texts for a business called "${businessName}". The customer gave ${stars} stars. Each review should be 2-3 sentences, genuine, mention the business name naturally, and include words like "excellent service", "highly recommend", "professional". Write each review on a separate line prefixed with "---". Write only the reviews, nothing else.`;

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-review-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          review_id: 'temp-' + Date.now(),
          reviewer_name: name || 'Customer',
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

  const copyReview = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    window.setTimeout(() => setCopiedIdx(null), 2000);
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) {
      setError('Please share your feedback');
      return;
    }
    setSubmitted(true);

    await supabase.from('reviews').insert({
      reviewer_name: name || 'Anonymous',
      rating,
      comment: feedback,
      source: 'direct',
      tags: [],
      status: 'need_attention',
      company_id: (profile as any)?.company_id || null,
    });

    setStep('thankyou');
  };

  const submitPositiveReview = async () => {
    await supabase.from('reviews').insert({
      reviewer_name: name || 'Anonymous',
      rating,
      comment: `Positive review via review link — redirected to ${platformLabels[getDestination(rating)] || 'review platform'}`,
      source: getDestination(rating) === 'google' ? 'google' : 'direct',
      tags: [],
      status: 'public',
      company_id: (profile as any)?.company_id || null,
    });
  };

  const openReviewPlatform = () => {
    submitPositiveReview();
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
            <div className="cr-emoji cr-emoji-sad"><Heart size={48} /></div>
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
    <div className="cr-page">
      <div className="cr-card">
        {/* Header */}
        <div className="cr-header">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="cr-logo" />
          ) : (
            <div className="cr-logo-placeholder">{businessName.charAt(0).toUpperCase()}</div>
          )}
          <h1>{businessName}</h1>
          {profile?.tagline && <p>{profile.tagline}</p>}
        </div>

        {/* Step: Rating */}
        {step === 'rating' && (
          <div className="cr-step">
            <h2>How was your experience?</h2>
            <p className="cr-subtitle">Your feedback helps us serve you better</p>
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

        {/* Step: Positive (4-5 stars) */}
        {step === 'positive' && (
          <div className="cr-step">
            <div className="cr-emoji"><ThumbsUp size={40} /></div>
            <h2>Thank you for the {rating}-star rating!</h2>
            <p className="cr-subtitle">We&apos;d love it if you could share your experience on Google. Here are some review templates you can use — just copy and paste!</p>

            {generating ? (
              <div className="cr-generating">
                <Loader2 size={24} className="spin" />
                <span>Generating review templates for you...</span>
              </div>
            ) : (
              <>
                <div className="cr-ai-reviews">
                  {aiReviews.map((review, idx) => (
                    <div className="cr-ai-review-card" key={idx}>
                      <div className="cr-ai-review-header">
                        <Sparkles size={14} />
                        <span>AI-Generated Review</span>
                      </div>
                      <p>{review}</p>
                      <button
                        className="cr-copy-btn"
                        onClick={() => copyReview(review, idx)}
                      >
                        {copiedIdx === idx ? (
                          <><Check size={14} /> Copied!</>
                        ) : (
                          <><Copy size={14} /> Copy Review</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cr-positive-actions">
                  {platformLinks[getDestination(rating)] && (
                    <button className="cr-google-btn" onClick={openReviewPlatform}>
                      <ExternalLink size={18} /> Go to {platformLabels[getDestination(rating)]} &amp; Paste
                    </button>
                  )}
                  <button className="cr-skip-btn" onClick={() => { submitPositiveReview(); setStep('thankyou'); }}>
                    Skip &amp; Submit
                  </button>
                </div>

                <div className="cr-instructions">
                  <strong>How it works:</strong>
                  <ol>
                    <li>Copy one of the review templates above</li>
                    <li>Click &quot;Go to {platformLabels[getDestination(rating)] || 'Review Platform'}&quot;</li>
                    <li>Give us a 5-star rating</li>
                    <li>Paste the copied review and submit</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: Feedback (1-3 stars) */}
        {step === 'feedback' && (
          <div className="cr-step">
            <div className="cr-emoji cr-emoji-sad"><Heart size={40} /></div>
            <h2>We&apos;re sorry we fell short</h2>
            <p className="cr-subtitle">Your feedback is important to us. Please tell us what went wrong so we can make it right.</p>

            <div className="cr-feedback-form">
              <div className="cr-form-field">
                <label>Your Name (optional)</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div className="cr-form-field">
                <label>Your Feedback *</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Tell us about your experience..."
                  rows={5}
                />
              </div>
              {error && <p className="cr-error">{error}</p>}
              <button
                className="cr-submit-btn"
                onClick={submitFeedback}
                disabled={submitted}
              >
                <Send size={16} /> Submit Feedback
              </button>
            </div>
          </div>
        )}

        {/* Step: Thank You */}
        {step === 'thankyou' && (
          <div className="cr-step cr-thankyou">
            <div className="cr-emoji cr-emoji-happy"><Check size={48} /></div>
            <h2>Thank you!</h2>
            <p className="cr-subtitle">
              {rating >= 4
                ? 'Thank you for taking the time to share your experience. Your review means the world to us!'
                : 'Thank you for your feedback. We take your concerns seriously and will work to improve our service.'}
            </p>
            <button className="cr-done-btn" onClick={() => window.close()}>
              Done
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="cr-footer">
        <span>Powered by TheSmartCard</span>
      </div>
    </div>
  );
}
