import type { Metadata } from 'next';
import { supabase, type Card } from '@/lib/supabase';
import { CardClient } from './card-client';

type Props = { params: { handle: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await supabase
    .from('cards')
    .select('name, title, company, bio')
    .ilike('handle', params.handle)
    .eq('status', 'active')
    .maybeSingle();

  const card = data as Card | null;
  const name = card?.name || 'Business Card';
  const title = card?.title ? ` — ${card.title}` : '';
  const company = card?.company ? ` at ${card.company}` : '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thesmartcard.in';

  return {
    title: `${name}${title}${company}`,
    description: card?.bio || `Connect with ${name}${company}. View contact details, services, and save to your phone.`,
    alternates: { canonical: `${siteUrl}/card/${params.handle}` },
    openGraph: {
      title: `${name}${title}${company}`,
      description: card?.bio || `Connect with ${name}${company}. Call, message, save contact, and more.`,
      url: `${siteUrl}/card/${params.handle}`,
      type: 'profile',
      images: [{ url: '/images/app_banner.png', width: 1200, height: 630, alt: `${name} — Digital Business Card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name}${title}${company}`,
      description: card?.bio || `Connect with ${name}${company}.`,
    },
    robots: { index: true, follow: true },
  };
}

export default function Page({ params }: Props) {
  return <CardClient />;
}
