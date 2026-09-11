'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, Award, Check, ChevronRight, Copy, ExternalLink, Globe, Loader2, Mail, MapPin, MessageCircle, Phone, Play, ShoppingBag, Star, User, Users, Video, AlertTriangle, X } from 'lucide-react';
import { supabase, type Card, type Product, type BusinessProfile, type BusinessCertificate, type BusinessClient, type BusinessGalleryItem, type BusinessService, type BusinessStatistic, type BusinessTestimonial } from '@/lib/supabase';
import { useParams } from 'next/navigation';

type LeadMode = 'quote' | 'callback' | null;

type QuoteForm = { name: string; phone: string; email: string; requirement: string; message: string; preferred_contact: 'whatsapp' | 'call' | 'email' };
type CallbackForm = { name: string; phone: string; preferred_time: string; message: string };

const emptyQuote: QuoteForm = { name: '', phone: '', email: '', requirement: '', message: '', preferred_contact: 'whatsapp' };
const emptyCallback: CallbackForm = { name: '', phone: '', preferred_time: '', message: '' };

export function CardClient() {
  const params = useParams();
  const handle = params.handle as string;
  const [card, setCard] = useState<Card | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [gallery, setGallery] = useState<BusinessGalleryItem[]>([]);
  const [certificates, setCertificates] = useState<BusinessCertificate[]>([]);
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [testimonials, setTestimonials] = useState<BusinessTestimonial[]>([]);
  const [statistics, setStatistics] = useState<BusinessStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [cardExpired, setCardExpired] = useState(false);
  const [leadMode, setLeadMode] = useState<LeadMode>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuote);
  const [callbackForm, setCallbackForm] = useState<CallbackForm>(emptyCallback);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: cardData } = await supabase.from('cards').select('*').ilike('handle', handle).eq('status', 'active').maybeSingle();
      if (!cardData) { setNotFoundFlag(true); setLoading(false); return; }
      const currentCard = cardData as Card;
      setCard(currentCard);
      const companyId = currentCard.company_id;
      const [prodRes, profileRes, servicesRes, galleryRes, certificatesRes, clientsRes, testimonialsRes, statisticsRes] = await Promise.all([
        supabase.from('products').select('*').eq('card_id', currentCard.id).order('sort_order', { ascending: true }),
        companyId ? supabase.from('business_profile').select('*').eq('company_id', companyId).maybeSingle() : supabase.from('business_profile').select('*').limit(1).maybeSingle(),
        companyId ? supabase.from('business_services').select('*').eq('company_id', companyId).eq('is_enabled', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        companyId ? supabase.from('business_gallery').select('*').eq('company_id', companyId).eq('is_enabled', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        companyId ? supabase.from('business_certificates').select('*').eq('company_id', companyId).eq('is_enabled', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        companyId ? supabase.from('business_clients').select('*').eq('company_id', companyId).eq('is_enabled', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        companyId ? supabase.from('business_testimonials').select('*').eq('company_id', companyId).eq('is_enabled', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        companyId ? supabase.from('business_statistics').select('*').eq('company_id', companyId).eq('is_enabled', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
      ]);
      setProducts((prodRes.data as Product[]) || []);
      setProfile(profileRes.data as BusinessProfile | null);
      setServices((servicesRes.data as BusinessService[]) || []);
      setGallery((galleryRes.data as BusinessGalleryItem[]) || []);
      setCertificates((certificatesRes.data as BusinessCertificate[]) || []);
      setClients((clientsRes.data as BusinessClient[]) || []);
      setTestimonials((testimonialsRes.data as BusinessTestimonial[]) || []);
      setStatistics((statisticsRes.data as BusinessStatistic[]) || []);
      if (companyId) {
        const { data: trialData } = await supabase.rpc('is_trial_expired', { p_company_id: companyId });
        if (trialData) setCardExpired(true);
      }
      await supabase.from('cards').update({ views: currentCard.views + 1 }).eq('id', currentCard.id);
      setLoading(false);
    })();
  }, [handle]);

  const copyContact = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };
  const reviewUrl = profile?.review_slug ? `${window.location.origin}/review/${profile.review_slug}` : `${window.location.origin}/review`;
  const whatsappNumber = card?.whatsapp?.replace(/[^0-9]/g, '') || '';
  const whatsappLink = (message: string) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  const businessGreeting = `Hi ${card?.name || ''}, I found your business through your SmartCard. I would like to know more about your services.`;
  const openLead = (mode: LeadMode, requirement = '') => { setLeadMode(mode); setSubmitted(false); if (requirement) setQuoteForm(previous => ({ ...previous, requirement })); };

  const submitLead = async (event: FormEvent) => {
    event.preventDefault();
    if (!card?.company_id || !leadMode) return;
    setSubmitting(true);
    const result = leadMode === 'quote'
      ? await supabase.from('quote_enquiries').insert({ ...quoteForm, company_id: card.company_id, card_id: card.id })
      : await supabase.from('callback_requests').insert({ ...callbackForm, customer_name: callbackForm.name, customer_phone: callbackForm.phone, company_id: card.company_id, card_id: card.id });
    setSubmitting(false);
    if (result.error) return;
    setSubmitted(true);
    if (leadMode === 'quote') setQuoteForm(emptyQuote); else setCallbackForm(emptyCallback);
  };

  if (loading) return <div className="pc-page"><div className="pc-card"><div className="pc-loading"><Loader2 size={32} className="spin" /></div></div></div>;
  if (notFoundFlag || !card) return <div className="pc-page"><div className="pc-card"><div className="pc-not-found"><User size={48} /><h2>Card not found</h2><p>This business card may have been deactivated or the link is incorrect.</p></div></div><div className="pc-footer"><span>Powered by TheSmartCard</span></div></div>;
  if (cardExpired) return <div className="pc-page"><div className="pc-card"><div className="pc-not-found"><AlertTriangle size={48} /><h2>This card has expired</h2><p>The business owner needs to upgrade their plan to keep this card active.</p></div></div><div className="pc-footer"><span>Powered by TheSmartCard</span></div></div>;

  const initials = card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const smartMessage = (action: string) => `Hi ${card.name}, I found your SmartCard and would like to ${action}.`;
  const themePrimary = safeThemeColor(profile?.primary_color, '#5648db');
  const themeSecondary = safeThemeColor(profile?.secondary_color, '#7c6ff5');

  return (
    <div className="pc-page" style={{ '--pc-primary': themePrimary, '--pc-secondary': themeSecondary } as CSSProperties}>
      <div className="pc-card">
        <div className="pc-header"><div className="pc-header-bg" />{card.photo_url ? <img src={card.photo_url} alt={card.name} className="pc-photo" /> : <div className="pc-photo-placeholder">{initials}</div>}{card.logo_url && <img src={card.logo_url} alt={card.company || ''} className="pc-logo" />}<h1>{card.name}</h1>{card.title && <p className="pc-title">{card.title}</p>}{card.company && <p className="pc-company">{card.company}</p>}</div>
        {card.bio && <p className="pc-bio">{card.bio}</p>}
        <div className="pc-actions">{card.phone && <a href={`tel:${card.phone}`} className="pc-action-btn pc-phone"><Phone size={18} /> Call</a>}{card.whatsapp && <a href={whatsappLink(businessGreeting)} target="_blank" rel="noopener noreferrer" className="pc-action-btn pc-whatsapp"><MessageCircle size={18} /> WhatsApp</a>}{card.email && <a href={`mailto:${card.email}`} className="pc-action-btn pc-email"><Mail size={18} /> Email</a>}{card.website && <a href={card.website.startsWith('http') ? card.website : `https://${card.website}`} target="_blank" rel="noopener noreferrer" className="pc-action-btn pc-website"><Globe size={18} /> Website</a>}</div>
        <div className="pc-growth-actions"><button onClick={() => openLead('quote')}><ShoppingBag size={17} /> Get a Quote</button><button onClick={() => openLead('callback')}><Phone size={17} /> Request Callback</button></div>
        {card.whatsapp && <div className="pc-smart-actions"><span>Quick WhatsApp</span><div><a href={whatsappLink(smartMessage('know more about your services'))} target="_blank" rel="noopener noreferrer">Enquire Now</a><a href={whatsappLink(smartMessage('get a quotation'))} target="_blank" rel="noopener noreferrer">Get Quote</a><a href={whatsappLink(smartMessage('book an appointment'))} target="_blank" rel="noopener noreferrer">Book Appointment</a></div></div>}
        <div className="pc-details">{card.phone && <div className="pc-detail-row" onClick={() => copyContact(card.phone!)}><Phone size={16} /><span>{card.phone}</span>{copied && <Check size={14} className="pc-copied" />}</div>}{card.whatsapp && <div className="pc-detail-row" onClick={() => copyContact(card.whatsapp!)}><MessageCircle size={16} /><span>{card.whatsapp}</span></div>}{card.email && <div className="pc-detail-row" onClick={() => copyContact(card.email!)}><Mail size={16} /><span>{card.email}</span></div>}{card.website && <div className="pc-detail-row"><Globe size={16} /><span>{card.website}</span></div>}{profile?.address && (() => { const fullAddress = `${profile.address}${profile.city ? `, ${profile.city}` : ''}${profile.state ? `, ${profile.state}` : ''}`; const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`; return (<a href={mapUrl} target="_blank" rel="noopener noreferrer" className="pc-detail-row pc-detail-link"><MapPin size={16} /><span>{fullAddress}</span><ExternalLink size={13} className="pc-external-icon" /></a>); })()}</div>
        {statistics.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><Award size={18} /> At a glance</h3><div className="pc-stat-grid">{statistics.map(stat => <div key={stat.id}><strong>{stat.stat_value}</strong><span>{stat.stat_label}</span></div>)}</div></div>}
        {profile?.about && <div className="pc-section"><h3 className="pc-section-title"><User size={18} /> About the business</h3><p className="pc-rich-copy">{profile.about}</p></div>}
        {services.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><Award size={18} /> Services</h3><div className="pc-showcase-grid">{services.map(service => <article className="pc-showcase-card" key={service.id}>{service.image_url && <img src={service.image_url} alt={service.name} /> }<div><strong>{service.name}</strong><p>{service.description}</p>{service.starting_price !== null && <small>Starting at ₹{Number(service.starting_price).toLocaleString('en-IN')}</small>}<button onClick={() => service.cta_link ? window.open(service.cta_link, '_blank', 'noopener,noreferrer') : openLead('quote', service.name)}>{service.cta_label || 'Get Quote'} <ChevronRight size={14} /></button></div></article>)}</div></div>}
        {products.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><ShoppingBag size={18} /> Products & Services</h3><div className="pc-products">{products.map(p => <div className="pc-product-card" key={p.id}>{p.image_url && <img src={p.image_url} alt={p.name} className="pc-product-img" />}<div className="pc-product-info"><strong>{p.name}</strong>{p.description && <p>{p.description}</p>}{p.category && <span className="pc-product-cat">{p.category}</span>}</div><div className="pc-product-price">{p.price > 0 ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Free'}<span className={`pc-avail ${p.is_available ? 'yes' : 'no'}`}>{p.is_available ? 'Available' : 'Unavailable'}</span></div></div>)}</div></div>}
        {gallery.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><ImageIcon /> Gallery</h3><div className="pc-gallery-grid">{gallery.map(item => <figure key={`gallery-${item.id}`}><img src={item.image_url} alt={item.title || 'Business work'} /><figcaption>{item.title}</figcaption></figure>)}</div></div>}
        {clients.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><Users size={18} /> Trusted by</h3><div className="pc-client-grid">{clients.map(client => <div key={client.id} title={client.description || client.name}>{client.logo_url ? <img src={client.logo_url} alt={client.name} /> : <strong>{client.name}</strong>}<span>{client.name}</span></div>)}</div></div>}
        {testimonials.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><MessageCircle size={18} /> Customer words</h3><div className="pc-testimonial-list">{testimonials.map(testimonial => <blockquote key={testimonial.id}>{testimonial.avatar_url && <img src={testimonial.avatar_url} alt={testimonial.customer_name} />}<div><div className="pc-stars">{'★'.repeat(testimonial.rating)}<span>{'★'.repeat(5 - testimonial.rating)}</span></div><p>“{testimonial.testimonial_text}”</p><cite>{testimonial.customer_name}</cite></div></blockquote>)}</div></div>}
        {certificates.length > 0 && <div className="pc-section"><h3 className="pc-section-title"><Award size={18} /> Credentials</h3><div className="pc-certificate-list">{certificates.map(certificate => <div key={certificate.id}>{certificate.image_url && <img src={certificate.image_url} alt={certificate.name} />}<div><strong>{certificate.name}</strong><span>{certificate.issuing_organization}{certificate.year ? ` · ${certificate.year}` : ''}</span></div></div>)}</div></div>}
        {card.upi_id && <div className="pc-section"><h3 className="pc-section-title"><ShoppingBag size={18} /> Quick Pay</h3><a href={`upi://pay?pa=${encodeURIComponent(card.upi_id)}&pn=${encodeURIComponent(card.name)}`} className="pc-upi-btn">Pay via UPI — {card.upi_id}</a><div style={{ marginTop: 10, textAlign: 'center' }}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(card.upi_id)}%26pn=${encodeURIComponent(card.name)}`} alt="UPI QR Code" style={{ borderRadius: 12, display: 'inline-block' }} /><p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Scan to pay on desktop</p></div></div>}
        {card.video_url && <div className="pc-section"><h3 className="pc-section-title"><Video size={18} /> Video Intro</h3>{isDirectVideo(card.video_url) ? <div className="pc-video-embed"><video src={card.video_url} autoPlay controls playsInline loop style={{ width: '100%', borderRadius: '12px', display: 'block' }} /></div> : showVideo ? <div className="pc-video-embed"><iframe src={normalizeYouTube(card.video_url) + '?autoplay=1&rel=0'} title="Video Intro" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <button className="pc-video-play" onClick={() => setShowVideo(true)}><Play size={24} /> Watch Video</button>}</div>}
        {(profile?.facebook || profile?.instagram || profile?.twitter || profile?.linkedin || profile?.youtube) && <div className="pc-section"><h3 className="pc-section-title"><Globe size={18} /> Follow</h3><div className="pc-social-row">{profile.facebook && <a href={socialUrl(profile.facebook, 'https://facebook.com/')} target="_blank" rel="noopener noreferrer" className="pc-social-btn">Facebook</a>}{profile.instagram && <a href={socialUrl(profile.instagram, 'https://instagram.com/')} target="_blank" rel="noopener noreferrer" className="pc-social-btn">Instagram</a>}{profile.twitter && <a href={socialUrl(profile.twitter, 'https://twitter.com/')} target="_blank" rel="noopener noreferrer" className="pc-social-btn">Twitter</a>}{profile.linkedin && <a href={socialUrl(profile.linkedin, 'https://linkedin.com/in/')} target="_blank" rel="noopener noreferrer" className="pc-social-btn">LinkedIn</a>}{profile.youtube && <a href={socialUrl(profile.youtube, 'https://youtube.com/@')} target="_blank" rel="noopener noreferrer" className="pc-social-btn">YouTube</a>}</div></div>}
        <div className="pc-review-section"><a href={reviewUrl} className="pc-review-btn"><Star size={18} /> Give Review</a></div>
        <div className="pc-save-contact"><button onClick={() => downloadVCard(card, profile)}><User size={16} /> Save to Contacts</button></div>
      </div>
      <div className="pc-footer"><span>Powered by TheSmartCard</span></div>
      {leadMode && <div className="pc-modal-overlay"><div className="pc-lead-modal"><button className="pc-modal-close" onClick={() => setLeadMode(null)} aria-label="Close"><X size={18} /></button>{submitted ? <div className="pc-lead-success"><Check size={34} /><h2>Thanks, we received it</h2><p>{leadMode === 'quote' ? 'The business will get back to you shortly.' : 'The business owner will contact you at your preferred time.'}</p><button onClick={() => setLeadMode(null)}>Done</button></div> : <><h2>{leadMode === 'quote' ? 'Get a Quote' : 'Request a Callback'}</h2><p>{leadMode === 'quote' ? 'Tell the business what you need and they will prepare the right response.' : 'Share your details and choose a convenient time to talk.'}</p><form onSubmit={submitLead}>{leadMode === 'quote' ? <><input required value={quoteForm.name} onChange={e => setQuoteForm({ ...quoteForm, name: e.target.value })} placeholder="Your name" /><input required value={quoteForm.phone} onChange={e => setQuoteForm({ ...quoteForm, phone: e.target.value })} placeholder="Mobile number" type="tel" /><input value={quoteForm.email} onChange={e => setQuoteForm({ ...quoteForm, email: e.target.value })} placeholder="Email (optional)" type="email" /><input required value={quoteForm.requirement} onChange={e => setQuoteForm({ ...quoteForm, requirement: e.target.value })} placeholder="What do you need?" /><textarea required value={quoteForm.message} onChange={e => setQuoteForm({ ...quoteForm, message: e.target.value })} placeholder="Add a short message" rows={3} /><select value={quoteForm.preferred_contact} onChange={e => setQuoteForm({ ...quoteForm, preferred_contact: e.target.value as QuoteForm['preferred_contact'] })}><option value="whatsapp">Contact me on WhatsApp</option><option value="call">Call me</option><option value="email">Email me</option></select></> : <><input required value={callbackForm.name} onChange={e => setCallbackForm({ ...callbackForm, name: e.target.value })} placeholder="Your name" /><input required value={callbackForm.phone} onChange={e => setCallbackForm({ ...callbackForm, phone: e.target.value })} placeholder="Mobile number" type="tel" /><input value={callbackForm.preferred_time} onChange={e => setCallbackForm({ ...callbackForm, preferred_time: e.target.value })} placeholder="Preferred time (optional)" /><textarea value={callbackForm.message} onChange={e => setCallbackForm({ ...callbackForm, message: e.target.value })} placeholder="Message (optional)" rows={3} /></>}<button className="pc-lead-submit" disabled={submitting}>{submitting ? 'Sending...' : leadMode === 'quote' ? 'Send Enquiry' : 'Request Callback'}</button></form></>}</div></div>}
    </div>
  );
}

function safeThemeColor(value: string | null | undefined, fallback: string): string { return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback; }
function ImageIcon() { return <span style={{ fontSize: 16 }}>▧</span>; }
function socialUrl(value: string, prefix: string): string { const v = value.trim().replace(/^@/, ''); if (v.startsWith('http')) return v; return `${prefix}${v}`; }
function isDirectVideo(url: string): boolean { return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url); }
function normalizeYouTube(url: string): string { if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1].split(/[?&]/)[0]}`; if (url.includes('shorts/')) return `https://www.youtube.com/embed/${url.split('shorts/')[1].split(/[?&]/)[0]}`; return url.replace('watch?v=', 'embed/'); }
function downloadVCard(card: Card, profile: BusinessProfile | null) { const vcf = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${card.name}`, card.title ? `TITLE:${card.title}` : '', card.company ? `ORG:${card.company}` : '', card.phone ? `TEL;TYPE=CELL:${card.phone}` : '', card.email ? `EMAIL:${card.email}` : '', card.website ? `URL:${card.website}` : '', profile?.address ? `ADR:;;${profile.address};${profile.city || ''};${profile.state || ''};${profile.pincode || ''};India` : '', 'END:VCARD'].filter(Boolean).join('\n'); const blob = new Blob([vcf], { type: 'text/vcard' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${card.name.replace(/\s+/g, '_')}.vcf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
