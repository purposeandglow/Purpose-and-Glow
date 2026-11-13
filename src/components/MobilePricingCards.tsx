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
  onOpenAssessment,
  isDarkMode = false
}: MobilePricingCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 mt-6">
      {PRICING_PACKAGES.map((pkg) => (
        <div
          key={pkg.id}
          className={`relative rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 ${
            pkg.popular
              ? isDarkMode
                ? 'bg-gradient-to-b from-[#1E2333] to-[#121624] border-pink-500 shadow-xl shadow-pink-950/30 ring-1 ring-pink-500/50'
                : 'bg-gradient-to-b from-[#FFF5F8] to-white border-[#C2185B] shadow-xl shadow-pink-100/60 ring-1 ring-[#C2185B]/30'
              : isDarkMode
              ? 'bg-[#121624] border-slate-800 text-slate-100 hover:border-slate-700'
              : 'bg-white border-[#fce8f0] text-slate-900 shadow-sm hover:border-pink-200'
          }`}
        >
          {pkg.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white text-[11px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1 whitespace-nowrap">
              <Star className="w-3 h-3 fill-white" />
              <span>{pkg.tag}</span>
            </div>
          )}

          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                {!pkg.popular && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9C1450] dark:text-pink-400 px-2 py-0.5 rounded bg-pink-500/10">
                    {pkg.tag}
                  </span>
                )}
                <h3 className={`text-lg font-bold tracking-tight ${pkg.popular ? 'mt-1' : 'mt-2'}`}>
                  {pkg.name}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold text-[#C2185B] dark:text-pink-400">
                  {pkg.price}
                </div>
                <div className="text-[10px] opacity-65 flex items-center gap-1 justify-end">
                  <Clock className="w-2.5 h-2.5 text-pink-500" />
                  <span>{pkg.turnaround}</span>
                </div>
              </div>
            </div>

            <p className="text-xs opacity-75 mt-2 mb-4 leading-relaxed">
              {pkg.target}
            </p>

            <ul className="space-y-2 text-xs mb-5 border-t pt-3 border-slate-700/15">
              {pkg.bullets.map((b, bIdx) => (
                <li key={bIdx} className="flex items-start gap-2">
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
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                pkg.popular
                  ? 'bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#801040] text-white hover:brightness-110 shadow-md shadow-pink-500/30'
                  : 'border border-slate-400/30 hover:border-pink-500 text-current hover:bg-pink-500/10'
              }`}
            >
              <span>{pkg.price === '$0' ? 'Request Free Assessment' : `Select ${pkg.name}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
