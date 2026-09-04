'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ReviewRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    (async () => {
      const handle = searchParams.get('handle');

      if (handle) {
        const { data: card } = await supabase
          .from('cards')
          .select('company_id')
          .ilike('handle', handle)
          .maybeSingle();

        if (card?.company_id) {
          const { data: bp } = await supabase
            .from('business_profile')
            .select('review_slug')
            .eq('company_id', card.company_id)
            .maybeSingle();
          if (bp?.review_slug) {
            router.replace(`/review/${bp.review_slug}`);
            return;
          }
        }
      }

      const { data } = await supabase
        .from('business_profile')
        .select('review_slug')
        .not('review_slug', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.review_slug) {
        router.replace(`/review/${data.review_slug}`);
      } else {
        router.replace('/dashboard');
      }
    })();
  }, [router, searchParams]);

  return (
    <div className="cr-page">
      <div className="cr-card">
        <div className="cr-loading"><Loader2 size={32} className="spin" /></div>
      </div>
    </div>
  );
}
