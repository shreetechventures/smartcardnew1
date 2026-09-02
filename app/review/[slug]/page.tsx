import type { Metadata } from 'next';
import { supabase, type BusinessProfile } from '@/lib/supabase';
import { ReviewClient } from './review-client';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await supabase
    .from('business_profile')
    .select('business_name, tagline, about')
    .eq('review_slug', params.slug)
    .maybeSingle();

  const profile = data as BusinessProfile | null;
  const businessName = profile?.business_name || 'Business';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thesmartcard.in';

  return {
    title: `Review ${businessName}`,
    description: profile?.tagline || `Share your experience with ${businessName}. Your feedback helps them serve you better.`,
    alternates: { canonical: `${siteUrl}/review/${params.slug}` },
    openGraph: {
      title: `Review ${businessName}`,
      description: profile?.tagline || `Share your experience with ${businessName}.`,
      url: `${siteUrl}/review/${params.slug}`,
      type: 'website',
      images: [{ url: '/images/app_banner.png', width: 1200, height: 630, alt: `Review ${businessName}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Review ${businessName}`,
      description: profile?.tagline || `Share your experience with ${businessName}.`,
    },
    robots: { index: true, follow: true },
  };
}

export default function Page({ params }: Props) {
  return <ReviewClient params={params} />;
}
