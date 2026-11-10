import React, { useState } from 'react';
import { Compass, CheckCircle2, ArrowRight, RotateCcw, Sparkles, ChevronRight, DollarSign, Clock } from 'lucide-react';

interface FindYourServiceGuideProps {
  onSelectService: (serviceName: string) => void;
  onOpenAssessment: () => void;
  isDarkMode?: boolean;
}

interface QuestionStep {
  id: number;
  title: string;
  subtitle: string;
  options: {
    label: string;
    description: string;
    tag: string;
    match: string;
  }[];
}

const STEPS: QuestionStep[] = [
  {
    id: 1,
    title: 'Where are you currently at in your career journey?',
    subtitle: 'Select the option that best reflects your current professional standing.',
    options: [
      {
        label: 'Student, recent grad, or entry-level',
        description: 'Completed school/certifications and seeking an internship or first career role.',
        tag: 'Student / Early Career',
        match: 'student'
      },
      {
        label: 'Have an existing résumé that needs modernization',
        description: '2–7 years experience. You have a document, but it reads like a boring job description.',
        tag: 'Professional Revamp',
        match: 'revamp'
      },
      {
        label: 'Tenured 8–15+ years or pivoting to a new industry',
        description: 'Need a complete overhaul from the ground up to translate transferable strengths.',
        tag: 'Executive & Career Pivot',
        match: 'scratch'
      },
      {
        label: 'Need interview confidence & 1-on-1 coaching',
        description: 'Getting callbacks or have interviews lined up, but nervous about behavioral questions.',
        tag: 'Interview Prep',
        match: 'interview'
      },
      {
        label: 'Looking for free résumé feedback first',
        description: 'Want a professional second set of eyes to share clear suggestions at zero cost.',
        tag: 'Free DIY Recommendations',
        match: 'diy'
      }
    ]
  },
  {
    id: 2,
    title: 'What is your primary roadblock right now?',
    subtitle: 'Identify the main bottleneck preventing you from landing interviews.',
    options: [
      {
        label: 'Submitting applications online with zero recruiter response',
        description: 'Likely an ATS keyword parse failure or buried accomplishments.',
        tag: 'ATS Optimization',
        match: 'ats'
      },
      {
        label: 'My bullets only list duties (“Responsible for...”) rather than results',
        description: 'Need to uncover metrics, percentages, revenue impact, or workflow improvements.',
        tag: 'Duty-to-Metric Rewrite',
        match: 'metrics'
      },
      {
        label: 'Changing careers and don’t know how to translate my previous titles',
        description: 'Need strategic narrative framing so recruiters understand your value immediately.',
        tag: 'Transferable Value',
        match: 'pivot'
      },
      {
        label: 'Stumbling over “Tell me about yourself” or salary negotiations',
        description: 'Need structured mock practice using the STAR behavioral framework.',
        tag: 'Interview Coaching',
        match: 'prep'
      }
    ]
  }
];

export function FindYourServiceGuide({
  onSelectService,
  onOpenAssessment,
  isDarkMode = false
}: FindYourServiceGuideProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});

  const handleSelectOption = (stepId: number, matchKey: string) => {
    const updated = { ...selectedAnswers, [stepId]: matchKey };
    setSelectedAnswers(updated);
    if (stepId < STEPS.length) {
      setCurrentStep(stepId + 1);
    } else {
      setCurrentStep(3); // Result step
    }
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setCurrentStep(1);
  };

  // Determine recommendation based on choices
  const q1 = selectedAnswers[1];
  const q2 = selectedAnswers[2];

  let recommendation = {
    title: 'Professional Résumé Revamp',
    price: '$99',
    badge: 'Recommended for You',
    timeframe: '24–48 Business Hours',
    description:
      'The ideal solution to transform your existing work history into quantified, ATS-optimized contribution bullets that command recruiter attention.',
    features: [
      'Complete ground-up rewrite of your professional summary and experience bullets',
      'Transforms duty lists into metric-driven achievements',
      'ATS-compliant formatting designed for Applicant Tracking Systems',
      'Delivered in both editable Microsoft Word (.docx) and PDF formats'
    ],
    serviceId: 'Professional Résumé Revamp — $99'
  };

  if (q1 === 'student') {
    recommendation = {
      title: 'Student & Early Career Résumé',
      price: '$50',
      badge: 'Student Friendly Rate',
      timeframe: '24–48 Business Hours',
      description:
        'Tailored specifically for students and recent graduates stepping into healthcare, business, and clinical administration without paying corporate agency prices.',
      features: [
        'Translates coursework, clinical rotations, and internships into hireable skills',
        'Clean, modern layout that highlights academic and hands-on preparation',
        'Direct consultation with Nicole to highlight leadership and volunteer impact',
        'Delivered in editable Word (.docx) and presentation-ready PDF'
      ],
      serviceId: 'Student & Early Career Résumé — $50'
    };
  } else if (q1 === 'scratch' || q2 === 'pivot') {
    recommendation = {
      title: 'Résumé Created From Scratch',
      price: '$145',
      badge: 'In-Depth Career Pivot Overhaul',
      timeframe: '3–5 Business Days',
      description:
        'A comprehensive, collaborative build for professionals with 8–15+ years of multifaceted experience or anyone orchestrating a major industry shift.',
      features: [
        'Detailed intake synthesis translating years of diverse experience into one clear narrative',
        'Strategic positioning of transferable skills so new hiring managers get your value',
        'Complete ATS alignment matching target job requirements',
        'Direct collaboration and revisions until you feel 100% confident'
      ],
      serviceId: 'Created From Scratch — $145'
    };
  } else if (q1 === 'interview' || q2 === 'prep') {
    recommendation = {
      title: 'Interview Preparation Session',
      price: '$65',
      badge: 'Confidence & Strategy Coaching',
      timeframe: 'Flexible Scheduling',
      description:
        '1-on-1 personalized interview coaching focusing on high-impact responses, salary conversations, and structured STAR story articulation.',
      features: [
        'Practice real behavioral and situational interview questions',
        'Master the "Tell me about yourself" opener with confidence and poise',
        'Constructive, encouraging feedback on body language, pacing, and tone',
        'Personalized follow-up notes and key question talking points'
      ],
      serviceId: 'Interview Preparation Session — $65'
    };
  } else if (q1 === 'diy') {
    recommendation = {
      title: 'Free DIY Résumé Recommendations',
      price: '$0',
      badge: 'Zero Obligation Free Review',
      timeframe: '24–48 Business Hours',
      description:
        'Get 3 actionable recommendations highlighting your résumé’s strongest achievements and formatting improvements so you can update it yourself.',
      features: [
        'Confidential human review with specific bullet improvement examples',
        'Identifies what hiring managers scan for in the first 6 seconds',
        'Zero high-pressure sales pitches or spam follow-ups',
        'Free to implement on your own schedule'
      ],
      serviceId: 'Free DIY Résumé Recommendations'
    };
  }

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-7 shadow-xl transition-all duration-300 ${
        isDarkMode
          ? 'bg-[#121624]/90 border-pink-500/20 text-slate-100 shadow-pink-950/20'
          : 'bg-white border-[#FCD6E4] text-slate-900 shadow-pink-100/40'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-6 border-slate-700/20">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#C2185B]">
            <Compass className="w-4 h-4" />
            <span>Interactive Matcher</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
            Find Your Recommended Service
          </h3>
          <p className="text-xs sm:text-sm opacity-80 mt-0.5">
            Answer 2 quick questions to discover the exact service tailored to your career goals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-slate-400/30 text-xs font-semibold hover:bg-slate-500/10 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Over</span>
            </button>
          )}
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-500 border border-pink-500/20">
            Step {Math.min(currentStep, 2)} of 2
          </span>
        </div>
      </div>

      {currentStep <= 2 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-base sm:text-lg font-bold">
              {STEPS[currentStep - 1].title}
            </h4>
            <p className="text-xs opacity-75">
              {STEPS[currentStep - 1].subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            {STEPS[currentStep - 1].options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(currentStep, opt.match)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start justify-between gap-3 group ${
                  isDarkMode
                    ? 'bg-slate-900/60 border-slate-800 hover:border-pink-500/60 hover:bg-pink-950/20'
                    : 'bg-slate-50/80 border-slate-200 hover:border-[#C2185B] hover:bg-[#FFF5F8]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-pink-500/15 text-pink-600 dark:text-pink-400">
                      {opt.tag}
                    </span>
                    <strong className="text-sm font-semibold group-hover:text-[#C2185B] dark:group-hover:text-pink-400 transition-colors">
                      {opt.label}
                    </strong>
                  </div>
                  <p className="text-xs opacity-70 pl-0.5">
                    {opt.description}
                  </p>
                </div>
                <div className="w-6 h-6 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#C2185B] group-hover:text-white transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Step 3: Recommendation Result */
        <div className="space-y-5">
          <div
            className={`p-4 sm:p-5 rounded-xl border relative overflow-hidden ${
              isDarkMode
                ? 'bg-gradient-to-br from-pink-950/40 via-slate-900 to-slate-900 border-pink-500/40'
                : 'bg-gradient-to-br from-[#FFF5F8] via-white to-pink-50 border-pink-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 mb-3 border-pink-500/20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-500 px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/20">
                  {recommendation.badge}
                </span>
                <h4 className="text-xl sm:text-2xl font-bold mt-1">
                  {recommendation.title}
                </h4>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#C2185B] dark:text-pink-400">
                  {recommendation.price}
                </div>
                <div className="text-[11px] opacity-70 flex items-center gap-1 sm:justify-end">
                  <Clock className="w-3 h-3 text-pink-500" />
                  <span>{recommendation.timeframe}</span>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm opacity-90 leading-relaxed mb-4">
              {recommendation.description}
            </p>

            <div className="space-y-2 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                Included in this package:
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {recommendation.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-pink-500/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <button
                type="button"
                onClick={onOpenAssessment}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-pink-500/40 text-xs font-semibold text-pink-600 dark:text-pink-300 hover:bg-pink-500/10 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-pink-500" />
                <span>Get Free Assessment First ($0)</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectService(recommendation.serviceId)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#801040] text-white text-xs font-bold hover:brightness-110 shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
              >
                <span>Select {recommendation.title}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
