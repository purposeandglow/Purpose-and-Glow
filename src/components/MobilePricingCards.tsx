import React from 'react';
import { Check, Sparkles, ArrowRight, Clock, Star } from 'lucide-react';

interface MobilePricingCardsProps {
  onSelectService: (serviceName: string) => void;
  onOpenAssessment: () => void;
  isDarkMode?: boolean;
}

const PRICING_PACKAGES = [
  {
    id: 'revamp',
    name: 'Résumé Revamp',
    price: '$99',
    turnaround: '24–48 Business Hours',
    popular: true,
    tag: 'Most Popular Choice',
    target: 'Existing professionals with a draft needing modernisation',
    bullets: [
      'Complete overhaul of existing résumé with modern ATS layout',
      'Transforms duty lists into metric-driven accomplishments',
      'Strategic professional summary & keyword optimization',
      'Delivered in editable Word (.docx) and high-res PDF',
      'Fast 24–48 hour turnaround window'
    ],
    serviceId: 'Professional Résumé Revamp — $99'
  },
  {
    id: 'scratch',
    name: 'Created From Scratch',
    price: '$145',
    turnaround: '3–5 Business Days',
    popular: false,
    tag: 'Tenured & Pivot Specialist',
    target: 'Professionals with 8–15+ years experience or changing fields',
    bullets: [
      'Built from the ground up through in-depth collaborative intake',
      'Synthesizes multi-year career history into a cohesive story',
      'Translates transferable skills for new industries',
      'Full ATS alignment for target roles',
      'Word (.docx) + presentation-ready PDF'
    ],
    serviceId: 'Created From Scratch — $145'
  },
  {
    id: 'student',
    name: 'Student Résumé Services',
    price: '$50',
    turnaround: '24–48 Business Hours',
    popular: false,
    tag: 'Early Career Rate',
    target: 'Students & recent college or vocational graduates',
    bullets: [
      'Highlights coursework, clinicals, and transferable projects',
      'Formatted to capture hiring managers for entry-level roles',
      'Clean single-column layout optimized for online portals',
      'Delivered in editable Word and PDF format'
    ],
    serviceId: 'Student & Early Career Résumé — $50'
  },
  {
    id: 'career-ready',
    name: 'Career Ready Package',
    price: '$189',
    turnaround: '3–5 Business Days',
    popular: false,
    tag: 'Complete Bundle',
    target: 'Applicants updating an existing résumé who want full interview readiness',
    bullets: [
      'Includes Professional Résumé Revamp ($99 value)',
      'Custom Cover Letter tailored to a target role ($49 value)',
      '45-minute Google Meet Interview Prep + written guide ($65 value)',
      'Cohesive formatting delivered in Word (.docx) & PDF'
    ],
    serviceId: 'Career Ready Package — $189'
  },
  {
    id: 'fresh-start',
    name: 'Fresh Start Package',
    price: '$239',
    turnaround: '3–5 Business Days',
    popular: false,
    tag: 'From-Scratch Bundle',
    target: 'Clients starting from scratch who want complete application and interview support',
    bullets: [
      'Includes Résumé Created From Scratch ($145 value)',
      'Custom Cover Letter tailored to a target role ($49 value)',
      '45-minute Google Meet Interview Prep + written guide ($65 value)',
      'Delivered in editable Word (.docx) and high-res PDF'
    ],
    serviceId: 'Fresh Start Package — $239'
  },
  {
    id: 'interview',
    name: 'Interview Preparation',
    price: '$65',
    turnaround: 'Flexible Scheduling',
    popular: false,
    tag: 'Coaching',
    target: 'Job seekers with upcoming interviews needing structured practice',
    bullets: [
      '45-minute 1-on-1 interview preparation session via Google Meet',
      'Brief written preparation guide covering common questions & strategy',
      'Practice structuring clear, confident STAR responses',
      'Constructive, encouraging communication feedback'
    ],
    serviceId: 'Interview Preparation Session — $65'
  },
  {
    id: 'cover-letter',
    name: 'Cover Letter',
    price: '$49',
    turnaround: '24–48 Business Hours',
    popular: false,
    tag: 'Add-on',
    target: 'Candidates wanting a role-specific opening letter',
    bullets: [
      'Written specifically for one target position and company',
      'Highlights relevant qualifications and motivation',
      'Includes Microsoft Word (.docx), PDF, and one round of revisions'
    ],
    serviceId: 'Targeted Cover Letter — $49'
  },
  {
    id: 'tailoring',
    name: 'Résumé Tailoring',
    price: '$45',
    turnaround: '24–48 Business Hours',
    popular: false,
    tag: 'Job-Specific',
    target: 'Clients polishing an existing résumé for one specific job posting',
    bullets: [
      'Optimizes wording and keyword alignment for a target job description',
      'Refines summary and bullets to emphasize matching qualifications',
      'Delivered in editable Word (.docx) and PDF'
    ],
    serviceId: 'Job-Specific Résumé Tailoring — $45'
  },
  {
    id: 'diy',
    name: 'Free DIY Recommendations',
    price: '$0',
    turnaround: '24–48 Business Hours',
    popular: false,
    tag: '100% Free · No Obligation',
    target: 'Anyone who prefers to edit their own résumé',
    bullets: [
      'Honest recommendations identifying key résumé improvements',
      'Practical formatting and clarity guidance you can apply yourself',
      'Zero obligation to purchase paid services'
    ],
    serviceId: 'Free DIY Résumé Recommendations'
  }
];

export function MobilePricingCards({
  onSelectService,
  isDarkMode = false
}: MobilePricingCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5 font-[var(--sans)]">
      {PRICING_PACKAGES.map((pkg, idx) => {
        const isLastCard = idx === PRICING_PACKAGES.length - 1;
        return (
          <div
            key={pkg.id}
            className={`relative rounded-xl border p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 min-w-0 ${
              isLastCard ? 'sm:col-span-2 lg:col-span-1' : ''
            } ${
              pkg.popular
                ? isDarkMode
                  ? 'bg-gradient-to-b from-[#1E2333] to-[#121624] border-pink-500 shadow-lg shadow-pink-950/30 ring-1 ring-pink-500/40'
                  : 'bg-gradient-to-b from-[#FFF5F8] to-white border-[#C2185B] shadow-lg shadow-pink-100/60 ring-1 ring-[#C2185B]/25'
                : isDarkMode
                ? 'bg-[#121624] border-slate-800 text-slate-100 hover:border-slate-700'
                : 'bg-white border-[#fce8f0] text-slate-900 shadow-xs hover:border-pink-200'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {pkg.popular ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#C2185B] text-white">
                      <Star className="w-3 h-3 fill-white" />
                      <span>{pkg.tag}</span>
                    </span>
                  ) : (
                    <span className="inline-block text-[10.5px] font-bold uppercase tracking-wider text-[#9C1450] dark:text-pink-400 px-2 py-0.5 rounded bg-pink-500/10">
                      {pkg.tag}
                    </span>
                  )}
                  <h3 className="text-lg font-bold tracking-tight leading-snug mt-2">
                    {pkg.name}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-extrabold text-[#C2185B] dark:text-pink-400 leading-none">
                    {pkg.price}
                  </div>
                  <div className="text-[11px] opacity-75 flex items-center gap-1 justify-end mt-1.5 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-pink-500" />
                    <span>{pkg.turnaround}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-[13px] opacity-80 mt-2.5 mb-4 leading-relaxed">
                {pkg.target}
              </p>

              <ul
                className={`border-t pt-3.5 border-slate-500/20 text-xs sm:text-[13px] mb-5 ${
                  isLastCard ? 'grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2' : 'space-y-2'
                }`}
              >
                {pkg.bullets.map((b, bIdx) => (
                  <li key={bIdx} className="flex items-start gap-2 leading-snug">
                    <Check className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onSelectService(pkg.serviceId)}
                className={`w-full min-h-[42px] py-2.5 px-4 rounded-lg text-xs sm:text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                  pkg.popular
                    ? 'bg-[#C2185B] hover:bg-[#9C1450] text-white shadow-sm'
                    : 'border border-slate-400/35 hover:border-[#C2185B] text-current hover:bg-pink-500/10'
                }`}
              >
                <span>{pkg.price === '$0' ? 'Request Free Assessment' : `Select ${pkg.name}`}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
