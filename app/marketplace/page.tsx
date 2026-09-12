'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CreditCard, Menu, Search, ShoppingBag, Star, X } from 'lucide-react';
import { supabase, type MarketplaceListing } from '@/lib/supabase';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

const categories = [
  { id: 'all', label: 'All' },
  { id: 'template', label: 'Templates' },
  { id: 'theme', label: 'Themes' },
  { id: 'service', label: 'Services' },
  { id: 'addon', label: 'Add-ons' },
];

export default function MarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setListings((data as MarketplaceListing[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = listings.filter((l) => {
    const matchCat = activeCategory === 'all' || l.category === activeCategory;
    const matchSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.business_category || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="landing-page">
      <header className={`lp-header ${scrolled ? 'lp-header-scrolled' : ''}`}>
        <div className="lp-header-inner">
          <Link href="/" className="lp-brand">
            <div className="lp-brand-mark"><CreditCard size={22} /></div>
            <span>TheSmartCard</span>
          </Link>
          <nav className="lp-nav">
            <Link href="/#features">Growth Tools</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/marketplace" className="!text-[#5648db] font-semibold">Marketplace</Link>
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
            <Link href="/#features" onClick={() => setMobileMenuOpen(false)}>Growth Tools</Link>
            <Link href="/#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)}>Marketplace</Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="lp-cta-btn">Get Started</Link>
          </div>
        )}
      </header>

      <section className="mp-hero">
        <div className="mp-hero-bg" />
        <div className="mp-hero-content">
          <span className="lp-eyebrow"><ShoppingBag size={14} /> Marketplace</span>
          <h1>Discover businesses, services &<br />templates on TheSmartCard</h1>
          <p>Browse every business and offering listed on our platform. From local services to premium templates, find what you need or list your own.</p>
        </div>
      </section>

      <div className="mp-toolbar-wrap">
        <div className="mp-toolbar">
          <div className="mp-search-box">
            <Search size={16} />
            <input
              placeholder="Search businesses, services, templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mp-filters">
            {categories.map((c) => (
              <button
                key={c.id}
                className={activeCategory === c.id ? 'mp-filter-active' : ''}
                onClick={() => setActiveCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mp-count">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      <section className="mp-grid-section">
        {loading ? (
          <div className="mp-empty">Loading marketplace...</div>
        ) : filtered.length === 0 ? (
          <div className="mp-empty">
            <ShoppingBag size={48} />
            <h3>No listings found</h3>
            <p>{search ? 'Try a different search.' : 'Check back soon for new businesses and offerings.'}</p>
          </div>
        ) : (
          <div className="marketplace-grid">
            {filtered.map((listing) => (
              <div className="marketplace-card" key={listing.id}>
                <div
                  className="marketplace-thumb"
                  style={
                    listing.image_url
                      ? undefined
                      : {
                          background: `linear-gradient(135deg, ${
                            listing.category === 'template'
                              ? '#5648db'
                              : listing.category === 'theme'
                                ? '#7c3aed'
                                : listing.category === 'service'
                                  ? '#0ea5e9'
                                  : '#f59e0b'
                          }, ${
                            listing.category === 'template'
                              ? '#7c3aed'
                              : listing.category === 'theme'
                                ? '#9333ea'
                                : listing.category === 'service'
                                  ? '#0284c7'
                                  : '#d97706'
                          })`,
                        }
                  }
                >
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ShoppingBag size={32} />
                  )}
                  {listing.price === 0 && <span className="marketplace-free-tag">FREE</span>}
                </div>
                <div className="marketplace-info">
                  <div className="marketplace-cat">{listing.category}</div>
                  <strong>{listing.title}</strong>
                  {listing.description && <p>{listing.description}</p>}
                  {(listing.business_name || listing.business_location) && (
                    <div className="mp-business-info">
                      {listing.business_name && <span className="mp-biz-name">{listing.business_name}</span>}
                      {listing.business_location && <span className="mp-biz-loc">{listing.business_location}</span>}
                    </div>
                  )}
                  {listing.business_category && <span className="mp-biz-cat">{listing.business_category}</span>}
                  <div className="marketplace-meta">
                    <div className="marketplace-rating">
                      <Star size={13} className="star-filled" /> {listing.rating.toFixed(1)}
                    </div>
                    <span className="muted">{listing.downloads} downloads</span>
                  </div>
                  <div className="marketplace-footer">
                    <span className="marketplace-price">
                      {listing.price === 0 ? 'Free' : `\u20b9${listing.price.toLocaleString('en-IN')}`}
                    </span>
                    {listing.contact_no && (
                      <a href={`tel:${listing.contact_no}`} className="primary-btn sm">Contact</a>
                    )}
                  </div>
                  {listing.creator && <span className="marketplace-creator">by {listing.creator}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mp-cta-section">
        <div className="mp-cta-content">
          <h2>List your business on the marketplace</h2>
          <p>Join TheSmartCard and your business automatically appears here for customers to discover.</p>
          <Link href="/dashboard" className="lp-cta-btn lg">
            Get Started <ArrowRight size={16} />
          </Link>
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
              <Link href="/#features">Features</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/marketplace">Marketplace</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Contact</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
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
