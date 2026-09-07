export type BillingCycle = 'monthly' | 'annual';

export type PlanInfo = {
  id: string;
  name: string;
  price: number;
  monthlyPrice: number;
  originalPrice: number | null;
  period: string;
  features: string[];
  badge?: string;
  highlight?: boolean;
  trialNote?: string;
};

export const plans: PlanInfo[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    monthlyPrice: 0,
    originalPrice: 0,
    period: 'year',
    features: ['1 Smart Card', 'Reviews', 'QR Codes', 'Settings'],
    trialNote: 'Free for 3 days only',
  },
  {
    id: 'business',
    name: 'Business',
    price: 1999,
    monthlyPrice: 199,
    originalPrice: 4999,
    period: 'year',
    features: ['2 Smart Cards', 'Analytics', 'Leads', 'Reviews', 'QR Codes', 'Marketplace', 'Payments', 'Settings'],
    badge: 'BEST VALUE',
    highlight: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 2999,
    monthlyPrice: 299,
    originalPrice: 9999,
    period: 'year',
    features: ['3 Smart Cards', 'Analytics', 'Leads', 'Reviews', 'QR Codes', 'Marketplace', 'Payments', 'AI Studio', 'Website Builder', 'Contacts', 'Settings'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 4999,
    monthlyPrice: 499,
    originalPrice: 12999,
    period: 'year',
    features: ['5 Smart Cards', 'Analytics', 'Leads', 'Reviews', 'QR Codes', 'Marketplace', 'Payments', 'AI Studio', 'Website Builder', 'Contacts', 'Team', 'Settings', 'Priority Support'],
  },
];

export type PlanConfigRow = {
  id: string;
  name: string;
  price: number;
  monthly_price: number | null;
  original_price: number | null;
  period: string;
  features: string[];
  badge: string | null;
  highlight: boolean;
  trial_note: string | null;
  sort_order: number;
};

export function mapPlanConfig(row: PlanConfigRow): PlanInfo {
  const annualPrice = Number(row.price);
  const monthlyPrice = row.monthly_price !== null ? Number(row.monthly_price) : Math.round(annualPrice / 12);
  return {
    id: row.id,
    name: row.name,
    price: annualPrice,
    monthlyPrice,
    originalPrice: row.original_price !== null ? Number(row.original_price) : null,
    period: row.period,
    features: row.features || [],
    badge: row.badge || undefined,
    highlight: row.highlight,
    trialNote: row.trial_note || undefined,
  };
}

export function getDisplayPrice(plan: PlanInfo, cycle: BillingCycle): number {
  if (cycle === 'monthly') return plan.monthlyPrice;
  return plan.price;
}

export function getDisplayPeriod(cycle: BillingCycle): string {
  return cycle === 'monthly' ? 'month' : 'year';
}
