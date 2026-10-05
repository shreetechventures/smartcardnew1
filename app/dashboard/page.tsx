'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type NavKey } from '@/components/dashboard-shell';
import { DashboardView } from '@/components/views/dashboard-view';
import { CardsView } from '@/components/views/cards-view';
import { ContactsView } from '@/components/views/contacts-view';
import { ReviewsView } from '@/components/views/reviews-view';
import { AnalyticsView } from '@/components/views/analytics-view';
import { QRCodesView } from '@/components/views/qrcodes-view';
import { TeamView } from '@/components/views/team-view';
import { SubscriptionView } from '@/components/views/subscription-view';
import { PaymentsView } from '@/components/views/payments-view';
import { SettingsView } from '@/components/views/settings-view';
import { BusinessSetupView } from '@/components/views/business-setup-view';
import { ShowcaseView } from '@/components/views/showcase-view';
import { AiStudioView } from '@/components/views/ai-studio-view';
import { WebsiteBuilderView } from '@/components/views/website-builder-view';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { session, loading, recovering } = useAuth();
  const router = useRouter();
  const [activeNav, setActiveNavState] = useState<NavKey>(() => {
    if (typeof window === 'undefined') return 'Dashboard';
    const saved = localStorage.getItem('tsm-active-nav');
    return (saved as NavKey) || 'Dashboard';
  });

  const setActiveNav = (key: NavKey) => {
    setActiveNavState(key);
    try { localStorage.setItem('tsm-active-nav', key); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!loading && !recovering && !session) {
      router.replace('/auth');
    }
  }, [session, loading, recovering, router]);

  const renderView = () => {
    switch (activeNav) {
      case 'Dashboard':
        return <DashboardView onNavigate={setActiveNav} />;
      case 'Business Setup':
        return <BusinessSetupView onNavigate={setActiveNav} />;
      case 'Showcase':
        return <ShowcaseView />;
      case 'My Cards':
        return <CardsView />;
      case 'Contacts':
        return <ContactsView />;
      case 'Analytics':
        return <AnalyticsView />;
      case 'Reviews':
        return <ReviewsView />;
      case 'QR Codes':
        return <QRCodesView />;
      case 'AI Studio':
        return <AiStudioView />;
      case 'Website Builder':
        return <WebsiteBuilderView />;
      case 'Team':
        return <TeamView />;
      case 'Subscription':
        return <SubscriptionView />;
      case 'Payments':
        return <PaymentsView />;
      case 'Settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setActiveNav} />;
    }
  };

  if (loading || (!session && !recovering)) {
    return (
      <div className="auth-loading">
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  return (
    <DashboardShell active={activeNav} onNavigate={setActiveNav}>
      {renderView()}
    </DashboardShell>
  );
}
