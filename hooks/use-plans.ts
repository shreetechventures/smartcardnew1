'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { plans as defaultPlans, mapPlanConfig, type PlanInfo, type PlanConfigRow } from '@/lib/plans';

export function usePlans() {
  const [plans, setPlans] = useState<PlanInfo[]>(defaultPlans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('plans_config')
          .select('*')
          .order('sort_order', { ascending: true });
        if (!cancelled && !error && data && data.length > 0) {
          setPlans((data as PlanConfigRow[]).map(mapPlanConfig));
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { plans, loading };
}
