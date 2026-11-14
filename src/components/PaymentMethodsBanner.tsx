import React from 'react';
import { CreditCard, ShieldCheck, CheckCircle2, DollarSign } from 'lucide-react';

interface PaymentMethodsBannerProps {
  isDarkMode?: boolean;
}

export function PaymentMethodsBanner({ isDarkMode = false }: PaymentMethodsBannerProps) {
  return (
    <div
      className={`rounded-xl border p-5 sm:p-6 transition-all duration-200 font-[var(--sans)] ${
        isDarkMode
          ? 'bg-[#121624] border-slate-800 text-slate-100'
          : 'bg-white border-[#fce8f0] text-slate-900 shadow-xs'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9C1450] dark:text-pink-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Transparent Payment Options</span>
          </div>
          <h4 className="text-base sm:text-lg font-bold">
            Accepted Payment Methods
          </h4>
          <p className="text-xs sm:text-[13px] opacity-80 max-w-xl leading-relaxed">
            Purpose &amp; Glow accepts Apple Pay, Venmo, and Square invoices with zero surprise fees or recurring subscriptions. Payment links and invoices are sent directly once you confirm your service—payment plans are available upon request.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-[#9C1450] dark:text-pink-400"> Apple Pay</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-sky-700 dark:text-sky-400">Venmo</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">Square Invoice</span>
          </div>
        </div>
      </div>
    </div>
  );
}
