import React, { useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';

interface PromotionalBannerProps {
  onOpenAssessment: () => void;
  isDarkMode?: boolean;
}

export function PromotionalBanner({ onOpenAssessment }: PromotionalBannerProps) {
  const [isVisible, setIsVisible] = useState(() => {
    try {
      return localStorage.getItem('pg_promo_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('pg_promo_dismissed', 'true');
    } catch {}
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Promotional Announcement"
      className="relative z-50 bg-gradient-to-r from-[#9C1450] via-[#C2185B] to-[#7B1038] text-white py-2 px-4 sm:px-6 lg:px-8 text-xs transition-all duration-300 shadow-sm font-[var(--sans)]"
    >
      <div className="max-w-[1196px] mx-auto flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded bg-white/20 shrink-0 hidden sm:inline-flex">
            <Sparkles className="w-3.5 h-3.5 text-pink-200" />
          </span>
          <span className="font-medium truncate">
            <strong className="font-bold">Free Résumé Feedback:</strong>{' '}
            <span className="hidden sm:inline">Complimentary review and actionable recommendations with every consultation.</span>
            <span className="sm:hidden">Complimentary review &amp; guidance.</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAssessment}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-white text-[#9C1450] font-bold text-[11px] hover:bg-pink-50 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
          >
            <span className="hidden sm:inline">Free Assessment</span>
            <span className="sm:hidden">Free Review</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Dismiss announcement"
            aria-label="Dismiss announcement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
