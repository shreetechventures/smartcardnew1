'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CreditCard,
  Globe,
  Menu,
  MessageCircle,
  Palette,
  QrCode,
  Repeat,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { plans } from '@/lib/plans';
import { LandingJsonLd } from '@/components/landing-json-ld';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`lp-reveal ${visible ? 'lp-reveal-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-page">
      <LandingJsonLd />
      <header className={`lp-header ${scrolled ? 'lp-header-scrolled' : ''}`}>
        <div className="lp-header-inner">
          <Link href="/" className="lp-brand">
            <div className="lp-brand-mark"><CreditCard size={22} /></div>
            <span>TheSmartCard</span>
          </Link>
          <nav className="lp-nav">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#testimonials">Reviews</a>
            <Link href="/admin">Admin</Link>
          </nav>
          <div className="lp-header-actions">
            <Link href="/dashboard" className="lp-login-btn">Sign In</Link>
            <Link href="/dashboard" className="lp-cta-btn">Get Started <ArrowRight size={15} /></Link>
          </div>
          <button className="lp-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="lp-mobile-menu">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>Admin</Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="lp-cta-btn">Get Started</Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-mesh" />
        <div className="lp-hero-content">
          <div className="lp-hero-badge"><Sparkles size={14} /> Business Growth Platform</div>
          <h1>Grow Your Business.<br /><span className="lp-hero-accent">Turn Every Customer Into an Opportunity.</span></h1>
          <p>Every customer interaction becomes an opportunity to grow your business. Save contacts, collect genuine Google reviews, capture leads, and bring customers back.</p>
          <div className="lp-hero-actions">
            <Link href="/dashboard" className="lp-cta-btn lg"><Zap size={17} fill="currentColor" /> Start Free Today</Link>
            <a href="#pricing" className="lp-ghost-btn lg">View Pricing</a>
          </div>
          <div className="lp-hero-stats">
            <div><strong>1000+</strong><span>Businesses</span></div>
            <div><strong>50K+</strong><span>Contacts Saved</span></div>
            <div><strong>120K+</strong><span>Leads Captured</span></div>
            <div><strong>4.9</strong><span>Avg Rating</span></div>
          </div>
        </div>
        <div className="lp-hero-floating-cards">
          <div className="lp-float-card lp-float-card-1">
            <div className="lp-float-card-icon"><Star size={18} fill="currentColor" /></div>
            <div><strong>+47 Reviews</strong><span>This month</span></div>
          </div>
          <div className="lp-float-card lp-float-card-2">
            <div className="lp-float-card-icon"><Users size={18} /></div>
            <div><strong>124 Contacts</strong><span>Saved</span></div>
          </div>
          <div className="lp-float-card lp-float-card-3">
            <div className="lp-float-card-icon"><QrCode size={18} /></div>
            <div><strong>Scan & Connect</strong><span>Instant</span></div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="lp-trust-bar">
        <div className="lp-trust-inner">
          <span className="lp-trust-label">Trusted by local businesses across India</span>
          <div className="lp-trust-logos">
            {['Cafes', 'Salons', 'Clinics', 'Restaurants', 'Retail', 'Real Estate'].map((tag) => (
              <span key={tag} className="lp-trust-tag">{tag}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="lp-problem">
        <div className="lp-section-head">
          <span className="lp-eyebrow">The Problem</span>
          <h2>You work hard for every customer.<br />But what happens after they leave?</h2>
          <p>Most local businesses win trust in person, then lose momentum because there is no simple way to turn that trust into repeat business, reviews, and leads.</p>
        </div>
        <div className="lp-problem-grid">
          {[
            { icon: Users, title: 'Customers forget your contact', desc: 'They leave happy, but your number, address, and offer vanish from their day.' },
            { icon: Star, title: 'Happy customers stay silent', desc: 'The people who trust you rarely leave reviews unless you make it easy.' },
            { icon: Globe, title: 'Your business is hard to remember', desc: 'Offline trust does not automatically become online visibility.' },
            { icon: Repeat, title: 'Follow-up does not happen', desc: 'Without a simple system, good customer moments turn into missed opportunities.' },
          ].map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div className="lp-problem-card">
                <div className="lp-problem-icon"><p.icon size={22} /></div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Solution / Features */}
      <section className="lp-features" id="features">
        <div className="lp-section-head">
          <span className="lp-eyebrow">Everything You Need To Grow</span>
          <h2>How TheSmartCard helps<br />your business grow.</h2>
          <p>Simple tools that work together around one goal: turn customer interactions into measurable business outcomes.</p>
        </div>
        <div className="lp-features-grid">
          {[
            { icon: CreditCard, title: 'Smart Business Profile', desc: 'Give every customer one clear place to call, message, visit, review, and remember you.', color: 'violet' },
            { icon: Star, title: 'Reputation Engine', desc: 'Collect genuine reviews and route feedback in a way that protects trust.', color: 'amber' },
            { icon: Users, title: 'Lead Capture', desc: 'Turn customer interest into saved contacts your team can follow up with.', color: 'blue' },
            { icon: Share2, title: 'Smart Sharing', desc: 'Share your business from counters, posters, staff cards, WhatsApp, and campaigns.', color: 'green' },
            { icon: BarChart3, title: 'Growth Dashboard', desc: 'See customers saved, reviews collected, leads captured, and interactions started.', color: 'pink' },
            { icon: Repeat, title: 'Customer Follow-up', desc: 'Make it easier to bring happy customers back instead of hoping they remember.', color: 'indigo' },
            { icon: Palette, title: 'AI Growth Tools', desc: 'Create review posters, campaigns, and future business content faster.', color: 'violet' },
            { icon: Globe, title: 'Mini Website', desc: 'A simple future-ready web presence connected to your customer interactions.', color: 'blue' },
            { icon: MessageCircle, title: 'WhatsApp Integration', desc: 'Connect with customers directly through WhatsApp and keep conversations going.', color: 'green' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="lp-feature-card">
                <div className={`lp-feature-icon ${f.color}`}><f.icon size={24} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Growth Loop / Journey */}
      <section className="lp-journey">
        <div className="lp-section-head">
          <span className="lp-eyebrow">Business Journey</span>
          <h2>One customer interaction can<br />become a growth loop.</h2>
          <p>TheSmartCard connects the moments that usually disappear after a customer leaves.</p>
        </div>
        <div className="lp-journey-steps">
          {[
            { step: 1, title: 'Customer Visits', desc: 'A real interaction happens at your shop, office, salon, clinic, or restaurant.' },
            { step: 2, title: 'Interaction Starts', desc: 'They scan, tap, open your link, or connect through any future channel.' },
            { step: 3, title: 'Relationship Saved', desc: 'Your contact, offer, location, and next action stay with the customer.' },
            { step: 4, title: 'Trust Builds', desc: 'Happy customers are guided to leave genuine reviews at the right moment.' },
            { step: 5, title: 'Business Grows', desc: 'You get more leads, repeat visits, stronger reputation, and clearer momentum.' },
          ].map((s, i) => (
            <Reveal key={s.step} delay={i * 100}>
              <div className="lp-journey-step">
                <div className="lp-journey-number">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Reputation Engine */}
      <section className="lp-reputation">
        <div className="lp-reputation-content">
          <span className="lp-eyebrow">Reputation Engine</span>
          <h2>Reputation is not luck.<br />It is a system.</h2>
          <p>TheSmartCard helps happy customers leave public reviews, while private feedback gives you a chance to listen, improve, and protect trust.</p>
          <div className="lp-reputation-points">
            <div className="lp-reputation-point"><Check size={18} /> Customer shares experience</div>
            <div className="lp-reputation-point"><Check size={18} /> Smart routing guides next step</div>
            <div className="lp-reputation-point"><Check size={18} /> Trust grows publicly</div>
          </div>
          <div className="lp-reputation-highlight">
            <Star size={20} fill="currentColor" />
            <p>Good reviews become growth. Low ratings become learning.</p>
          </div>
        </div>
      </section>

      {/* Why Choose */}
      <section className="lp-why-choose">
        <div className="lp-section-head">
          <span className="lp-eyebrow">Why Businesses Choose TheSmartCard</span>
          <h2>Because local businesses need outcomes,<br />not another tool.</h2>
        </div>
        <div className="lp-why-grid">
          {[
            { icon: TrendingUp, title: 'Built around growth', desc: 'Every workflow points toward more customers, more trust, or stronger relationships.' },
            { icon: Zap, title: 'Simple enough for busy owners', desc: 'No complicated setup. The product should feel useful the same day it is created.' },
            { icon: Star, title: 'Trust-first by design', desc: 'Reputation, reviews, and customer confidence are treated as core business assets.' },
            { icon: Sparkles, title: 'Ready for the future', desc: 'Smart cards, reviews, AI, CRM, appointments, and mini websites all follow one promise.' },
          ].map((w, i) => (
            <Reveal key={w.title} delay={i * 80}>
              <div className="lp-why-card">
                <div className="lp-why-icon"><w.icon size={22} /></div>
                <h3>{w.title}</h3>
                <p>{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="lp-comparison">
        <div className="lp-section-head">
          <span className="lp-eyebrow">The Difference</span>
          <h2>Not a card. A business growth system.</h2>
          <p>Traditional business identity stops at sharing information. TheSmartCard keeps working after the customer leaves.</p>
        </div>
        <Reveal>
          <div className="lp-comparison-grid">
            <div className="lp-comparison-col lp-comparison-old">
              <h3>Traditional Visiting Card</h3>
              <ul>
                <li><X size={16} /> Shares information once</li>
                <li><X size={16} /> No way to track who saw it</li>
                <li><X size={16} /> No review collection</li>
                <li><X size={16} /> No lead capture</li>
                <li><X size={16} /> No follow-up system</li>
                <li><X size={16} /> Printed once, outdated fast</li>
              </ul>
            </div>
            <div className="lp-comparison-col lp-comparison-new">
              <h3>TheSmartCard</h3>
              <ul>
                <li><Check size={16} /> Keeps working after customer leaves</li>
                <li><Check size={16} /> Tracks every interaction</li>
                <li><Check size={16} /> Collects genuine Google reviews</li>
                <li><Check size={16} /> Captures leads automatically</li>
                <li><Check size={16} /> Follow-up built in</li>
                <li><Check size={16} /> Always up to date, instantly</li>
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Testimonials */}
      <section className="lp-testimonials" id="testimonials">
        <div className="lp-section-head">
          <span className="lp-eyebrow">Proof</span>
          <h2>Local businesses grow when<br />trust has a system.</h2>
        </div>
        <div className="lp-testimonials-grid">
          {[
            { name: 'Brew & Bliss Cafe', role: 'Cafe', text: 'Customers started saving our contact and leaving reviews without us asking awkwardly.', metric: '+47 reviews' },
            { name: 'Urban Salon', role: 'Salon', text: 'The biggest change is follow-up. We now know which customers interacted after visiting.', metric: '124 contacts saved' },
            { name: 'Smile Dental Clinic', role: 'Clinic', text: 'The review flow feels professional. It helped us turn patient trust into online trust.', metric: '3.8x more leads' },
          ].map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div className="lp-testimonial-card">
                <div className="lp-stars">{Array.from({ length: 5 }).map((_, j) => <Star key={j} size={16} className="lp-star-filled" />)}</div>
                <p>&ldquo;{t.text}&rdquo;</p>
                <div className="lp-testimonial-metric"><TrendingUp size={16} /> {t.metric}</div>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">{t.name.split(' ').map((w) => w[0]).join('')}</div>
                  <div><strong>{t.name}</strong><span>{t.role}</span></div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-section-head">
          <span className="lp-eyebrow">The Investment</span>
          <h2>Start simple. Grow with confidence.</h2>
          <p>Begin with the essentials your business needs to turn customer interactions into growth.</p>
        </div>
        <div className="lp-pricing-grid">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80}>
              <div className={`lp-plan-card ${plan.highlight ? 'lp-plan-highlight' : ''}`}>
                {plan.badge && <span className="lp-plan-badge">{plan.badge}</span>}
                <h3>{plan.name}</h3>
                <div className="lp-plan-price">
                  <strong>&#8377;{plan.price.toLocaleString('en-IN')}</strong>
                  <span>/{plan.period}</span>
                </div>
                {plan.originalPrice && plan.originalPrice > plan.price && (
                  <div className="lp-plan-original">&#8377;{plan.originalPrice.toLocaleString('en-IN')}/{plan.period}</div>
                )}
                {plan.trialNote && <div className="lp-plan-trial">{plan.trialNote}</div>}
                <ul className="lp-plan-features">
                  {plan.features.map((f, j) => (
                    <li key={j}><Check size={15} /> {f}</li>
                  ))}
                </ul>
                <Link href="/dashboard" className={plan.highlight ? 'lp-cta-btn' : 'lp-ghost-btn'}>
                  {plan.price === 0 ? 'Get Started' : 'Upgrade'}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-faq">
        <div className="lp-section-head">
          <span className="lp-eyebrow">FAQ</span>
          <h2>Questions business owners ask<br />before they start.</h2>
        </div>
        <div className="lp-faq-list">
          {[
            { q: 'Is TheSmartCard only a digital business card?', a: 'No. TheSmartCard is a business growth platform. The smart profile is only the starting point for reviews, leads, customer follow-up, and growth.' },
            { q: 'Can local businesses set it up easily?', a: 'Yes. The experience is built for busy owners who need something clear, useful, and simple to launch.' },
            { q: 'Does it help collect Google reviews?', a: 'Yes. The Reputation Engine helps guide happy customers toward public reviews and keeps private feedback useful.' },
            { q: 'What happens after someone interacts with my card?', a: 'The goal is to turn that interaction into a saved contact, lead, review, follow-up, or repeat customer.' },
          ].map((item, i) => (
            <details className="lp-faq-item" key={i}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-cta-section">
        <div className="lp-cta-bg" />
        <div className="lp-cta-content">
          <h2>Give every customer interaction a chance to grow your business.</h2>
          <p>Build trust, save relationships, collect reviews, and see what is working from one simple platform.</p>
          <Link href="/dashboard" className="lp-cta-btn lg"><Zap size={17} fill="currentColor" /> Start Free Today <ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <Link href="/" className="lp-brand">
              <div className="lp-brand-mark"><CreditCard size={20} /></div>
              <span>TheSmartCard</span>
            </Link>
            <p>Business Growth Platform for local businesses. Turn every customer interaction into an opportunity.</p>
          </div>
          <div className="lp-footer-links">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/admin">Admin Panel</Link>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Security</a>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>&copy; 2026 TheSmartCard. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
