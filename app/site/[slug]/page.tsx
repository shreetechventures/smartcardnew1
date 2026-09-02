import type { Metadata } from 'next';
import { supabase, type Website, type BusinessProfile } from '@/lib/supabase';
import { SiteClient } from './site-client';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await supabase
    .from('websites')
    .select('site_name, hero_title, hero_subtitle, slug')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle();

  const site = data as Website | null;
  const name = site?.hero_title || site?.site_name || 'Business Website';
  const tagline = site?.hero_subtitle || '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thesmartcard.in';

  return {
    title: name,
    description: tagline || `Visit ${name} — learn about our services, products, and team. Contact us today.`,
    alternates: { canonical: `${siteUrl}/site/${params.slug}` },
    openGraph: {
      title: name,
      description: tagline || `Visit ${name} — learn about our services, products, and team.`,
      url: `${siteUrl}/site/${params.slug}`,
      type: 'website',
      images: [{ url: '/images/app_banner.png', width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description: tagline || `Visit ${name}.`,
    },
    robots: { index: true, follow: true },
  };
}

export default function Page({ params }: Props) {
  return <SiteClient />;
}
