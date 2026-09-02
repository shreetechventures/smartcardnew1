'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useCompanyId() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      setCompanyId(data?.company_id ?? null);
      setLoading(false);
    };
    fetch();
  }, []);

  return { companyId, loading };
}
