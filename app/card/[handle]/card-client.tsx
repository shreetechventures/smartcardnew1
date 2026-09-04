'use client';

import { useEffect, useState } from 'react';
import {
  Check, Copy, ExternalLink, Globe, Loader2, Mail, MapPin, MessageCircle,
  Phone, Play, ShoppingBag, Star, User, Video,
} from 'lucide-react';
import { supabase, type Card, type Product, type BusinessProfile } from '@/lib/supabase';
import { notFound, useParams } from 'next/navigation';

export function CardClient() {
  const params = useParams();
  const handle = params.handle as string;

  const [card, setCard] = useState<Card | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: cardData } = await supabase
        .from('cards')
        .select('*')
        .ilike('handle', handle)
        .eq('status', 'active')
        .maybeSingle();

      if (!cardData) {
        setNotFoundFlag(true);
        setLoading(false);
        return;
      }

      const c = cardData as Card;
      setCard(c);

      const [prodRes, profileRes] = await Promise.all([
        supabase.from('products').select('*').eq('card_id', c.id).order('sort_order', { ascending: true }),
        supabase.from('business_profile').select('*').limit(1).maybeSingle(),
      ]);

      setProducts((prodRes.data as Product[]) || []);
      setProfile(profileRes.data as BusinessProfile | null);

      await supabase.from('cards').update({ views: c.views + 1 }).eq('id', c.id);
      setLoading(false);
    })();
  }, [handle]);

  const copyContact = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const reviewUrl = profile?.review_slug
    ? `${window.location.origin}/review/${profile.review_slug}`
    : `${window.location.origin}/review`;

  if (loading) {
    return (
      <div className="pc-page">
        <div className="pc-card">
          <div className="pc-loading"><Loader2 size={32} className="spin" /></div>
        </div>
      </div>
    );
  }

  if (notFoundFlag || !card) {
    return (
      <div className="pc-page">
        <div className="pc-card">
          <div className="pc-not-found">
            <User size={48} />
            <h2>Card not found</h2>
            <p>This business card may have been deactivated or the link is incorrect.</p>
          </div>
        </div>
        <div className="pc-footer"><span>Powered by TheSmartCard</span></div>
      </div>
    );
  }

  const initials = card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="pc-page">
      <div className="pc-card">
        {/* Header with photo/logo */}
        <div className="pc-header">
          <div className="pc-header-bg" />
          {card.photo_url ? (
            <img src={card.photo_url} alt={card.name} className="pc-photo" />
          ) : (
            <div className="pc-photo-placeholder">{initials}</div>
          )}
          {card.logo_url && <img src={card.logo_url} alt={card.company || ''} className="pc-logo" />}
          <h1>{card.name}</h1>
          {card.title && <p className="pc-title">{card.title}</p>}
          {card.company && <p className="pc-company">{card.company}</p>}
        </div>

        {/* Bio */}
        {card.bio && <p className="pc-bio">{card.bio}</p>}

        {/* Contact actions */}
        <div className="pc-actions">
          {card.phone && (
            <a href={`tel:${card.phone}`} className="pc-action-btn pc-phone">
              <Phone size={18} /> Call
            </a>
          )}
          {card.whatsapp && (
            <a href={`https://wa.me/${card.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="pc-action-btn pc-whatsapp">
              <MessageCircle size={18} /> WhatsApp
            </a>
          )}
          {card.email && (
            <a href={`mailto:${card.email}`} className="pc-action-btn pc-email">
              <Mail size={18} /> Email
            </a>
          )}
          {card.website && (
            <a href={card.website.startsWith('http') ? card.website : `https://${card.website}`} target="_blank" rel="noopener noreferrer" className="pc-action-btn pc-website">
              <Globe size={18} /> Website
            </a>
          )}
        </div>

        {/* Contact details list */}
        <div className="pc-details">
          {card.phone && (
            <div className="pc-detail-row" onClick={() => copyContact(card.phone!)}>
              <Phone size={16} />
              <span>{card.phone}</span>
              {copied && <Check size={14} className="pc-copied" />}
            </div>
          )}
          {card.whatsapp && (
            <div className="pc-detail-row" onClick={() => copyContact(card.whatsapp!)}>
              <MessageCircle size={16} />
              <span>{card.whatsapp}</span>
            </div>
          )}
          {card.email && (
            <div className="pc-detail-row" onClick={() => copyContact(card.email!)}>
              <Mail size={16} />
              <span>{card.email}</span>
            </div>
          )}
          {card.website && (
            <div className="pc-detail-row">
              <Globe size={16} />
              <span>{card.website}</span>
            </div>
          )}
          {profile?.address && (
            <div className="pc-detail-row">
              <MapPin size={16} />
              <span>{profile.address}{profile.city ? `, ${profile.city}` : ''}{profile.state ? `, ${profile.state}` : ''}</span>
            </div>
          )}
        </div>

        {/* UPI Payment */}
        {card.upi_id && (
          <div className="pc-section">
            <h3 className="pc-section-title"><ShoppingBag size={18} /> Quick Pay</h3>
            <a href={`upi://pay?pa=${card.upi_id}&pn=${encodeURIComponent(card.name)}`} className="pc-upi-btn">
              Pay via UPI — {card.upi_id}
            </a>
          </div>
        )}

        {/* Video intro */}
        {card.video_url && (
          <div className="pc-section">
            <h3 className="pc-section-title"><Video size={18} /> Video Intro</h3>
            {isDirectVideo(card.video_url) ? (
              <div className="pc-video-embed">
                <video src={card.video_url} autoPlay controls playsInline loop style={{ width: '100%', borderRadius: '12px', display: 'block' }} />
              </div>
            ) : showVideo ? (
              <div className="pc-video-embed">
                <iframe
                  src={card.video_url.replace('watch?v=', 'embed/') + (card.video_url.includes('?') ? '&' : '?') + 'autoplay=1'}
                  title="Video Intro"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <button className="pc-video-play" onClick={() => setShowVideo(true)}>
                <Play size={24} /> Watch Video
              </button>
            )}
          </div>
        )}

        {/* Products */}
        {products.length > 0 && (
          <div className="pc-section">
            <h3 className="pc-section-title"><ShoppingBag size={18} /> Products & Services</h3>
            <div className="pc-products">
              {products.map(p => (
                <div className="pc-product-card" key={p.id}>
                  {p.image_url && <img src={p.image_url} alt={p.name} className="pc-product-img" />}
                  <div className="pc-product-info">
                    <strong>{p.name}</strong>
                    {p.description && <p>{p.description}</p>}
                    {p.category && <span className="pc-product-cat">{p.category}</span>}
                  </div>
                  <div className="pc-product-price">
                    {p.price > 0 ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Free'}
                    <span className={`pc-avail ${p.is_available ? 'yes' : 'no'}`}>
                      {p.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social links */}
        {(profile?.facebook || profile?.instagram || profile?.twitter || profile?.linkedin || profile?.youtube) && (
          <div className="pc-section">
            <h3 className="pc-section-title"><Globe size={18} /> Follow</h3>
            <div className="pc-social-row">
              {profile?.facebook && (
                <a href={`https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer" className="pc-social-btn">Facebook</a>
              )}
              {profile?.instagram && (
                <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer" className="pc-social-btn">Instagram</a>
              )}
              {profile?.twitter && (
                <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="pc-social-btn">Twitter</a>
              )}
              {profile?.linkedin && (
                <a href={`https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="pc-social-btn">LinkedIn</a>
              )}
              {profile?.youtube && (
                <a href={`https://youtube.com/@${profile.youtube}`} target="_blank" rel="noopener noreferrer" className="pc-social-btn">YouTube</a>
              )}
            </div>
          </div>
        )}

        {/* Give Review button */}
        <div className="pc-review-section">
          <a href={reviewUrl} className="pc-review-btn">
            <Star size={18} /> Give Review
          </a>
        </div>

        {/* Save contact button */}
        <div className="pc-save-contact">
          <button onClick={() => downloadVCard(card, profile)}>
            <User size={16} /> Save to Contacts
          </button>
        </div>
      </div>

      <div className="pc-footer">
        <span>Powered by TheSmartCard</span>
      </div>
    </div>
  );
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function downloadVCard(card: Card, profile: BusinessProfile | null) {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.name}`,
    card.title ? `TITLE:${card.title}` : '',
    card.company ? `ORG:${card.company}` : '',
    card.phone ? `TEL;TYPE=CELL:${card.phone}` : '',
    card.email ? `EMAIL:${card.email}` : '',
    card.website ? `URL:${card.website}` : '',
    profile?.address ? `ADR:;;${profile.address};${profile.city || ''};${profile.state || ''};${profile.pincode || ''};India` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n');

  const blob = new Blob([vcf], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${card.name.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
