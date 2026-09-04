import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thesmartcard.in';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TheSmartCard — Digital Business Cards, Reviews, Leads & Growth Platform',
    template: '%s | TheSmartCard',
  },
  description: 'Create smart digital business cards, collect Google reviews, capture leads, build a mini website, and grow your business. TheSmartCard turns every customer interaction into an opportunity for growth.',
  keywords: [
    'digital business card',
    'smart business card',
    'digital visiting card',
    'online business card',
    'Google review collection',
    'lead capture',
    'customer follow-up',
    'QR code business card',
    'NFC business card',
    'mini website builder',
    'business growth platform',
    'review management',
    'contact management',
    'digital identity',
    'smart card',
    'business card app',
    'review poster generator',
    'AI poster maker',
    'WhatsApp business integration',
    'local business growth',
  ],
  authors: [{ name: 'TheSmartCard' }],
  creator: 'TheSmartCard',
  publisher: 'TheSmartCard',
  applicationName: 'TheSmartCard',
  category: 'Business',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'TheSmartCard',
    title: 'TheSmartCard — Smart Identity, Smart Business',
    description: 'Create smart digital business cards, collect Google reviews, capture leads, and grow your business. Turn every customer interaction into an opportunity.',
    images: [
      {
        url: '/images/app_banner.png',
        width: 1200,
        height: 630,
        alt: 'TheSmartCard — Digital Business Card & Growth Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TheSmartCard — Smart Identity, Smart Business',
    description: 'Create smart digital business cards, collect Google reviews, capture leads, and grow your business.',
    images: ['/images/app_banner.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/images/app_banner.png',
  },
  other: {
    'google-site-verification': '',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#5648db',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={jakarta.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
