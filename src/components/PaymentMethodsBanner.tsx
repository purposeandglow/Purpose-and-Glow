import React from 'react';
import { CreditCard, ShieldCheck, CheckCircle2, DollarSign } from 'lucide-react';

interface PaymentMethodsBannerProps {
  isDarkMode?: boolean;
}

export function PaymentMethodsBanner({ isDarkMode = false }: PaymentMethodsBannerProps) {
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
        isDarkMode
          ? 'bg-[#121624] border-slate-800 text-slate-100'
          : 'bg-white border-[#fce8f0] text-slate-900 shadow-sm'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure &amp; Transparent Checkout</span>
          </div>
          <h4 className="text-base sm:text-lg font-bold">
            Accepted Payment Methods
          </h4>
          <p className="text-xs opacity-75 max-w-xl">
            We provide upfront, transparent billing with zero surprise charges or recurring subscriptions. Invoices are issued directly before final deliverables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-[#C2185B] dark:text-pink-400"> Apple Pay</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-sky-500">Venmo</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-emerald-500">Square Invoice</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs font-semibold flex items-center gap-2">
            <span className="font-bold text-slate-400">Credit / Debit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
