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
      className="relative z-50 bg-gradient-to-r from-[#9C1450] via-[#C2185B] to-[#7B1038] text-white py-2 px-3 sm:px-6 text-xs transition-all duration-300 shadow-sm"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="p-1 rounded bg-white/20 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-pink-200" />
          </span>
          <span className="font-medium truncate">
            <strong className="font-bold">Free Résumé Feedback:</strong> Complimentary review and actionable recommendations with every consultation.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAssessment}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#9C1450] font-bold text-[11px] hover:bg-pink-50 transition-colors shadow-sm"
          >
            <span>Claim Free Assessment</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
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
