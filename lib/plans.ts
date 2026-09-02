export type PlanInfo = {
  id: string;
  name: string;
  price: number;
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
    originalPrice: 0,
    period: 'year',
    features: ['1 Smart Card', 'Analytics', 'AI Review Management', 'Employee Management', 'AI Studio', 'Custom Domain', 'Priority Support'],
    trialNote: 'Free for 3 days only',
  },
  {
    id: 'business',
    name: 'Business',
    price: 1999,
    originalPrice: 4999,
    period: 'year',
    features: ['2 Smart Cards', 'Analytics', 'AI Review Management', 'Employee Management'],
    badge: 'BEST VALUE',
    highlight: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 2999,
    originalPrice: 9999,
    period: 'year',
    features: ['3 Smart Cards', 'Analytics', 'AI Review Management', 'Employee Management', 'AI Studio', 'Custom Domain', 'Priority Support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 4999,
    originalPrice: 12999,
    period: 'year',
    features: ['5 Smart Cards', 'Analytics', 'AI Review Management', 'Employee Management', 'AI Studio', 'Custom Domain', 'Priority Support'],
  },
];

export type PlanConfigRow = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  period: string;
  features: string[];
  badge: string | null;
  highlight: boolean;
  trial_note: string | null;
  sort_order: number;
};

export function mapPlanConfig(row: PlanConfigRow): PlanInfo {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    originalPrice: row.original_price !== null ? Number(row.original_price) : null,
    period: row.period,
    features: row.features || [],
    badge: row.badge || undefined,
    highlight: row.highlight,
    trialNote: row.trial_note || undefined,
  };
}
