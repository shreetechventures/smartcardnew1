'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type BusinessProfile } from '@/lib/supabase';

export function useBusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase.from('business_profile').select('*').maybeSingle();
    setProfile(data as BusinessProfile | null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return { profile, loading, refetch: fetchProfile };
}
