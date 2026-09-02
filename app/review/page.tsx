'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ReviewRedirect() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('business_profile')
        .select('review_slug')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data?.review_slug) {
        router.replace(`/review/${data.review_slug}`);
      } else {
        router.replace('/dashboard');
      }
    })();
  }, [router]);

  return (
    <div className="cr-page">
      <div className="cr-card">
        <div className="cr-loading"><Loader2 size={32} className="spin" /></div>
      </div>
    </div>
  );
}
