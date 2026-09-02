'use client';

import { useEffect, useState } from 'react';
import {
  Check, ExternalLink, Facebook, Globe, Instagram, Linkedin,
  Loader2, Mail, MapPin, Menu, MessageCircle, Phone, Star, Twitter, X, Youtube,
} from 'lucide-react';
import { supabase, type Website, type BusinessProfile, type Product, type Card } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export function SiteClient() {
  const params = useParams();
  const slug = params.slug as string;

  const [site, setSite] = useState<Website | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: siteData } = await supabase
        .from('websites')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (!siteData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const s = siteData as Website;
      setSite(s);

      const [profileRes, cardsRes] = await Promise.all([
        s.company_id
          ? supabase.from('business_profile').select('*').eq('company_id', s.company_id).maybeSingle()
          : supabase.from('business_profile').select('*').limit(1).maybeSingle(),
        s.company_id
          ? supabase.from('cards').select('*').eq('company_id', s.company_id).eq('status', 'active')
          : supabase.from('cards').select('*').eq('status', 'active'),
      ]);

      setProfile(profileRes.data as BusinessProfile | null);
      setCards((cardsRes.data as Card[]) || []);

      if (s.company_id) {
        const { data: prodData } = await supabase.from('products').select('*').eq('company_id', s.company_id).order('sort_order', { ascending: true });
        setProducts((prodData as Product[]) || []);
      }

      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="pw-page">
        <div className="pw-loading"><Loader2 size={40} className="spin" /></div>
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="pw-page">
        <div className="pw-not-found">
          <Globe size={56} />
          <h1>Website not found</h1>
          <p>This website may be unpublished or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const primaryColor = profile?.primary_color || '#5648db';
  const secondaryColor = profile?.secondary_color || '#7c3aed';
  const businessName = site.hero_title || profile?.business_name || site.site_name;
  const tagline = site.hero_subtitle || profile?.tagline || '';
  const aboutText = site.services || profile?.about || '';
  const sections = site.sections || ['hero', 'about', 'services', 'contact'];
  const logoUrl = profile?.logo_url;
  const reviewUrl = profile?.review_slug ? `/review/${profile.review_slug}` : '/review';

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="pw-page" style={{ '--pw-primary': primaryColor, '--pw-secondary': secondaryColor } as React.CSSProperties}>
      {/* Navigation */}
      <nav className="pw-nav">
        <div className="pw-nav-inner">
          <div className="pw-nav-brand">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="pw-nav-logo" />
            ) : (
              <span className="pw-nav-logo-text">{businessName.charAt(0).toUpperCase()}</span>
            )}
            <strong>{businessName}</strong>
          </div>
          <div className="pw-nav-links">
            {sections.includes('about') && <button onClick={() => scrollTo('about')}>About</button>}
            {sections.includes('services') && <button onClick={() => scrollTo('services')}>Services</button>}
            {sections.includes('gallery') && <button onClick={() => scrollTo('gallery')}>Gallery</button>}
            {sections.includes('reviews') && <button onClick={() => scrollTo('reviews')}>Reviews</button>}
            {sections.includes('contact') && <button onClick={() => scrollTo('contact')}>Contact</button>}
          </div>
          <button className="pw-nav-cta" onClick={() => scrollTo('contact')}>Get in Touch</button>
          <button className="pw-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="pw-mobile-menu">
            {sections.includes('about') && <button onClick={() => scrollTo('about')}>About</button>}
            {sections.includes('services') && <button onClick={() => scrollTo('services')}>Services</button>}
            {sections.includes('gallery') && <button onClick={() => scrollTo('gallery')}>Gallery</button>}
            {sections.includes('reviews') && <button onClick={() => scrollTo('reviews')}>Reviews</button>}
            {sections.includes('contact') && <button onClick={() => scrollTo('contact')}>Contact</button>}
          </div>
        )}
      </nav>

      {/* Hero */}
      {sections.includes('hero') && (
        <header className="pw-hero">
          <div className="pw-hero-bg" />
          <div className="pw-hero-content">
            {logoUrl && <img src={logoUrl} alt={businessName} className="pw-hero-logo" />}
            <h1>{businessName}</h1>
            {tagline && <p>{tagline}</p>}
            <div className="pw-hero-actions">
              <button className="pw-hero-btn-primary" onClick={() => scrollTo('contact')}>Contact Us</button>
              <button className="pw-hero-btn-secondary" onClick={() => scrollTo('services')}>Our Services</button>
            </div>
          </div>
        </header>
      )}

      {/* About */}
      {sections.includes('about') && (
        <section id="about" className="pw-section">
          <div className="pw-section-inner">
            <h2>About Us</h2>
            <div className="pw-about-grid">
              <div className="pw-about-text">
                <p>{aboutText}</p>
                {profile?.owner_name && (
                  <div className="pw-about-owner">
                    <div className="pw-about-owner-avatar">
                      {profile.owner_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{profile.owner_name}</strong>
                      {profile.owner_title && <span>{profile.owner_title}</span>}
                    </div>
                  </div>
                )}
              </div>
              <div className="pw-about-stats">
                <div className="pw-stat">
                  <strong>{cards.length}</strong>
                  <span>Team Members</span>
                </div>
                <div className="pw-stat">
                  <strong>{products.length}</strong>
                  <span>Products & Services</span>
                </div>
                <div className="pw-stat">
                  <strong>{profile?.city || 'India'}</strong>
                  <span>Location</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Services / Products */}
      {sections.includes('services') && (
        <section id="services" className="pw-section pw-section-alt">
          <div className="pw-section-inner">
            <h2>Our Products & Services</h2>
            {products.length > 0 ? (
              <div className="pw-products-grid">
                {products.map(p => (
                  <div className="pw-product-card" key={p.id}>
                    {p.image_url && <img src={p.image_url} alt={p.name} className="pw-product-img" />}
                    <div className="pw-product-body">
                      <strong>{p.name}</strong>
                      {p.description && <p>{p.description}</p>}
                      <div className="pw-product-footer">
                        {p.price > 0 ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Free'}
                        <span className={`pw-avail ${p.is_available ? 'yes' : 'no'}`}>
                          {p.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pw-services-list">
                {aboutText.split('\n').filter((line: string) => line.trim()).map((line: string, i: number) => (
                  <div className="pw-service-item" key={i}>
                    <Check size={20} />
                    <span>{line}</span>
                  </div>
                ))}
                {!aboutText && <p className="pw-empty">Services information will appear here once added.</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gallery */}
      {sections.includes('gallery') && (
        <section id="gallery" className="pw-section">
          <div className="pw-section-inner">
            <h2>Gallery</h2>
            <div className="pw-gallery-grid">
              {cards.filter(c => c.photo_url).map(c => (
                <div className="pw-gallery-item" key={c.id}>
                  <img src={c.photo_url!} alt={c.name} />
                  <div className="pw-gallery-overlay">
                    <strong>{c.name}</strong>
                    {c.title && <span>{c.title}</span>}
                  </div>
                </div>
              ))}
              {cards.filter(c => c.photo_url).length === 0 && (
                <p className="pw-empty">Gallery photos will appear here once team members add photos to their cards.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {sections.includes('reviews') && (
        <section id="reviews" className="pw-section pw-section-alt">
          <div className="pw-section-inner">
            <h2>What Our Customers Say</h2>
            <div className="pw-reviews-cta">
              <Star size={32} fill="currentColor" />
              <p>Share your experience with us</p>
              <a href={reviewUrl} className="pw-review-link">Leave a Review</a>
            </div>
          </div>
        </section>
      )}

      {/* Map */}
      {sections.includes('map') && profile?.address && (
        <section id="map" className="pw-section">
          <div className="pw-section-inner">
            <h2>Find Us</h2>
            <div className="pw-map-container">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${profile.address}, ${profile.city || ''}, ${profile.state || ''}`)}&output=embed`}
                width="100%"
                height="320"
                style={{ border: 0, borderRadius: '12px' }}
                loading="lazy"
              />
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      {sections.includes('contact') && (
        <section id="contact" className="pw-section pw-contact-section">
          <div className="pw-section-inner">
            <h2>Get in Touch</h2>
            <div className="pw-contact-grid">
              <div className="pw-contact-info">
                {profile?.phone && (
                  <a href={`tel:${profile.phone}`} className="pw-contact-item">
                    <Phone size={20} />
                    <div><strong>Call Us</strong><span>{profile.phone}</span></div>
                  </a>
                )}
                {profile?.whatsapp && (
                  <a href={`https://wa.me/${profile.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="pw-contact-item">
                    <MessageCircle size={20} />
                    <div><strong>WhatsApp</strong><span>{profile.whatsapp}</span></div>
                  </a>
                )}
                {profile?.email && (
                  <a href={`mailto:${profile.email}`} className="pw-contact-item">
                    <Mail size={20} />
                    <div><strong>Email</strong><span>{profile.email}</span></div>
                  </a>
                )}
                {profile?.address && (
                  <div className="pw-contact-item">
                    <MapPin size={20} />
                    <div><strong>Address</strong><span>{profile.address}{profile.city ? `, ${profile.city}` : ''}{profile.state ? `, ${profile.state}` : ''}{profile.pincode ? ` - ${profile.pincode}` : ''}</span></div>
                  </div>
                )}
                {profile?.website && (
                  <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="pw-contact-item">
                    <Globe size={20} />
                    <div><strong>Website</strong><span>{profile.website}</span></div>
                  </a>
                )}
              </div>
              <div className="pw-contact-social">
                {(profile?.facebook || profile?.instagram || profile?.twitter || profile?.linkedin || profile?.youtube) && (
                  <div className="pw-social-links">
                    {profile?.facebook && <a href={`https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer"><Facebook size={22} /></a>}
                    {profile?.instagram && <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer"><Instagram size={22} /></a>}
                    {profile?.twitter && <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer"><Twitter size={22} /></a>}
                    {profile?.linkedin && <a href={`https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer"><Linkedin size={22} /></a>}
                    {profile?.youtube && <a href={`https://youtube.com/@${profile.youtube}`} target="_blank" rel="noopener noreferrer"><Youtube size={22} /></a>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Team Cards */}
      {cards.length > 0 && (
        <section className="pw-section pw-section-alt">
          <div className="pw-section-inner">
            <h2>Our Team</h2>
            <div className="pw-team-grid">
              {cards.map(card => (
                <a href={`/card/${card.handle}`} key={card.id} className="pw-team-card">
                  {card.photo_url ? (
                    <img src={card.photo_url} alt={card.name} className="pw-team-photo" />
                  ) : (
                    <div className="pw-team-photo-placeholder">{card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                  )}
                  <strong>{card.name}</strong>
                  {card.title && <span>{card.title}</span>}
                  {card.company && <span className="pw-team-company">{card.company}</span>}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="pw-footer">
        <div className="pw-footer-inner">
          <div className="pw-footer-brand">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="pw-footer-logo" />
            ) : (
              <span className="pw-footer-logo-text">{businessName.charAt(0).toUpperCase()}</span>
            )}
            <strong>{businessName}</strong>
          </div>
          {tagline && <p>{tagline}</p>}
          <div className="pw-footer-social">
            {profile?.facebook && <a href={`https://facebook.com/${profile.facebook}`} target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>}
            {profile?.instagram && <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer"><Instagram size={18} /></a>}
            {profile?.twitter && <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer"><Twitter size={18} /></a>}
            {profile?.linkedin && <a href={`https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer"><Linkedin size={18} /></a>}
            {profile?.youtube && <a href={`https://youtube.com/@${profile.youtube}`} target="_blank" rel="noopener noreferrer"><Youtube size={18} /></a>}
          </div>
          <span className="pw-footer-powered">Powered by TheSmartCard</span>
        </div>
      </footer>
    </div>
  );
}
