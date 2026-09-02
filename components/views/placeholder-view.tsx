'use client';

import type { NavKey } from '@/components/dashboard-shell';

export function PlaceholderView({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-header">
      <div>
        <h2 className="page-title">{title}</h2>
        <p className="page-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
