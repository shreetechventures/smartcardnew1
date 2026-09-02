export function LandingJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thesmartcard.in';

  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TheSmartCard',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Create smart digital business cards, collect Google reviews, capture leads, build a mini website, and grow your business. TheSmartCard turns every customer interaction into an opportunity for growth.',
    url: siteUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      description: 'Free plan available with upgrade options',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '1000',
    },
    featureList: [
      'Smart Digital Business Cards',
      'Google Review Collection',
      'Lead Capture & CRM',
      'QR Code Generation',
      'AI Poster Generator',
      'Mini Website Builder',
      'WhatsApp Integration',
      'Growth Analytics Dashboard',
      'Team Management',
      'Customer Follow-up System',
    ],
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is TheSmartCard only a digital business card?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. TheSmartCard is a business growth platform. The smart profile is only the starting point for reviews, leads, customer follow-up, and growth.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can local businesses set it up easily?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The experience is built for busy owners who need something clear, useful, and simple to launch.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does it help collect Google reviews?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The Reputation Engine helps guide happy customers toward public reviews and keeps private feedback useful.',
        },
      },
      {
        '@type': 'Question',
        name: 'What happens after someone interacts with my card?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The goal is to turn that interaction into a saved contact, lead, review, follow-up, or repeat customer.',
        },
      },
    ],
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
    ],
  };

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TheSmartCard',
    url: siteUrl,
    description: 'Business Growth Platform for local businesses. Turn every customer interaction into an opportunity.',
    slogan: 'Smart Identity, Smart Business',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  );
}
