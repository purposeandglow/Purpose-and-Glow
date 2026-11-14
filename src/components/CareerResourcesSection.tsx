import React, { useState, useCallback } from 'react';
import { BookOpen, Check, ArrowRight, X, Sparkles, FileText, CheckSquare, Target, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface ArticleItem {
  id: string;
  category: string;
  readTime: string;
  title: string;
  summary: string;
  content: {
    sectionHeading: string;
    points: { title: string; desc: string }[];
  }[];
}

const CAREER_ARTICLES: ArticleItem[] = [
  {
    id: 'ats-myths',
    category: 'ATS Strategy',
    readTime: '3 min read',
    title: 'The 3 Biggest ATS Myths Costing Candidates Interviews',
    summary:
      'Why fancy two-column Canva templates get rejected and why invisible white text tricks actually get you disqualified.',
    content: [
      {
        sectionHeading: 'Myth #1: “You Need Fancy Graphics & Two-Column Split Layouts”',
        points: [
          {
            title: 'The Reality',
            desc: 'Many ATS scanners parse documents from left to right across the full width of the page. Two-column layouts often cause job titles from column 1 to merge with dates from column 2, confusing the parser.'
          },
          {
            title: 'The Fix',
            desc: 'Stick to clean, single-column hierarchy with clear standard headers (Experience, Education, Skills) that human recruiters and ATS robots can easily read.'
          }
        ]
      },
      {
        sectionHeading: 'Myth #2: “Hiding Keywords in White Text Tricks the Algorithm”',
        points: [
          {
            title: 'The Reality',
            desc: 'Modern ATS software strips all font color formatting and converts the document into raw plain text. A recruiter inspecting the plain text immediately sees the block of unformatted keywords and will disqualify the candidate for dishonesty.'
          },
          {
            title: 'The Fix',
            desc: 'Integrate authentic keywords organically into your bullet points where you demonstrate real-world usage.'
          }
        ]
      },
      {
        sectionHeading: 'Myth #3: “Robots Make 100% of the Hiring Decisions”',
        points: [
          {
            title: 'The Reality',
            desc: 'The ATS merely organizes, parses, and ranks incoming applicants. A human recruiter or hiring manager still makes the call on who to invite for an interview—usually spending only 6–10 seconds on the initial scan.'
          },
          {
            title: 'The Fix',
            desc: 'Format for the robot so you pass the scan, but write for the human so your accomplishments instantly make them say "I need to talk to this person."'
          }
        ]
      }
    ]
  },
  {
    id: 'xyz-formula',
    category: 'Résumé Crafting',
    readTime: '4 min read',
    title: 'The XYZ Formula: Turning Boring Duties into Power Bullets',
    summary:
      'Learn Google’s famous formula: “Accomplished [X], as measured by [Y], by doing [Z]” with concrete healthcare and business examples.',
    content: [
      {
        sectionHeading: 'Understanding the Shift from Duty to Contribution',
        points: [
          {
            title: 'The Duty Trap',
            desc: 'Most résumés sound like copied job descriptions: “Responsible for answering phone calls and processing claims.” This tells the hiring manager what you were supposed to do, not how well you did it.'
          },
          {
            title: 'The XYZ Formula',
            desc: 'Accomplished [X] (the outcome), as measured by [Y] (the metric/scale), by doing [Z] (the specific method or tool used).'
          }
        ]
      },
      {
        sectionHeading: 'Real-World Transformation Examples',
        points: [
          {
            title: 'Healthcare / Billing Example',
            desc: 'BEFORE: "Handled medical billing and denial appeals." → AFTER: "Overturned $185,000+ in blocked clinic insurance claims, reducing initial denial rate from 14% to 4.2% through streamlined root-cause coding audits."'
          },
          {
            title: 'Administration / Support Example',
            desc: 'BEFORE: "Scheduled meetings and answered client emails." → AFTER: "Optimized executive scheduling and communication workflows across a 40-person clinic, reducing appointment rescheduling delays by 35%."'
          }
        ]
      }
    ]
  },
  {
    id: 'interview-checklist',
    category: 'Interview Prep',
    readTime: '3 min read',
    title: 'The 24-Hour Pre-Interview Confidence Checklist',
    summary:
      'A practical step-by-step checklist to conquer anxiety, structure your STAR answers, and ask intelligent questions.',
    content: [
      {
        sectionHeading: 'Pre-Interview Preparation (24 Hours Prior)',
        points: [
          {
            title: 'Review the Job Posting',
            desc: 'Highlight 3 core problems the hiring team is trying to solve with this hire, and prepare a specific example from your past where you solved a similar problem.'
          },
          {
            title: 'Prepare 3 STAR Stories',
            desc: 'Situation, Task, Action, Result. Keep each story under 90 seconds and ensure the Result clearly highlights a positive metric or team benefit.'
          }
        ]
      },
      {
        sectionHeading: 'The Day of the Interview',
        points: [
          {
            title: 'Nail the Opening Question',
            desc: 'When asked "Tell me about yourself", do not recount your entire life story. Use the Present-Past-Future model: What you do currently, key career highlight from your past, and why this role is the natural next step.'
          },
          {
            title: 'Smart Reverse Questions',
            desc: 'Ask: "What does success look like in this role in the first 90 days?" and "What is the biggest challenge your team is currently navigating that I can help solve?"'
          }
        ]
      }
    ]
  }
];

interface CareerResourcesSectionProps {
  isDarkMode?: boolean;
}

export function CareerResourcesSection({ isDarkMode = false }: CareerResourcesSectionProps) {
  const [activeArticle, setActiveArticle] = useState<ArticleItem | null>(null);
  const closeArticle = useCallback(() => setActiveArticle(null), []);
  const articleDialogRef = useDialogAccessibility(Boolean(activeArticle), closeArticle, true);

  return (
    <section className="block" id="resources" data-sect data-label="Career Resources" aria-labelledby="resTitle">
      <div className="wrap">
        <div className="sh">
          <p className="label red">
            <span>Career Strategy &amp; Guides</span>
            <span>Free Guidance</span>
          </p>
          <h2 id="resTitle">
            Free Career Resources <em>&amp; Guides</em>
          </h2>
          <p>
            Actionable strategies and insider advice to help you navigate modern job searches, ATS filters, and interview anxiety.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5 font-[var(--sans)]">
          {CAREER_ARTICLES.map((art) => (
            <article
              key={art.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 shadow-xs min-w-0 ${
                isDarkMode
                  ? 'bg-[#121624] border-slate-800 hover:border-pink-500/40 text-slate-100'
                  : 'bg-white border-[#fce8f0] hover:border-pink-300 text-slate-900 shadow-pink-50/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#9C1450] dark:text-pink-400">
                  <span className="px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/20">
                    {art.category}
                  </span>
                  <span className="opacity-75 whitespace-nowrap">{art.readTime}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold leading-snug tracking-tight">
                  {art.title}
                </h3>
                <p className="text-xs sm:text-sm opacity-80 leading-relaxed">
                  {art.summary}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-500/20">
                <button
                  type="button"
                  onClick={() => setActiveArticle(art)}
                  className="w-full text-xs sm:text-sm font-semibold text-[#C2185B] dark:text-pink-400 hover:underline flex items-center justify-between cursor-pointer"
                >
                  <span>Read Guide</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Complimentary Job Search Registration Callout */}
        <div
          className={`mt-6 rounded-2xl border p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isDarkMode
              ? 'bg-[#121624] border-pink-500/25 text-slate-100'
              : 'bg-[#FFF5F8] border-[#FCD6E4] text-slate-900'
          }`}
        >
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9C1450] dark:text-pink-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Free Job Search Assistance Registration · $0</span>
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              Need Guidance Getting Your Job Search Organized?
            </h3>
            <p className="text-xs sm:text-sm opacity-85 leading-relaxed">
              Register for free job search recommendations and initial résumé feedback through Purpose &amp; Glow. Initial feedback, recommendations, and registration guidance are complimentary ($0). Personalized writing or coaching services are optional and priced upfront; free registration provides support and does not guarantee interviews, employment, or placement.
            </p>
          </div>
          <a
            href="https://tally.so/r/q5a1RY"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ink shrink-0 justify-center whitespace-nowrap"
          >
            <span>Register Free on Tally</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Article Full Detail Modal */}
        {activeArticle && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm"
            onClick={closeArticle}
          >
            <div
              ref={articleDialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="career-guide-modal-title"
              className={`relative w-full max-w-2xl my-auto rounded-2xl border shadow-2xl overflow-hidden outline-none ${
                isDarkMode ? 'bg-[#121624] border-pink-500/30 text-slate-100' : 'bg-white border-pink-200 text-slate-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] tracking-wider uppercase font-semibold text-pink-200">
                    {activeArticle.category} · {activeArticle.readTime}
                  </span>
                  <h4 id="career-guide-modal-title" className="text-lg font-bold">{activeArticle.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={closeArticle}
                  aria-label="Close career guide dialog"
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-sm">
                {activeArticle.content.map((sec, sIdx) => (
                  <div key={sIdx} className="space-y-3">
                    <h5 className="font-bold text-[#C2185B] dark:text-pink-400 text-sm border-b pb-1.5 border-pink-500/20">
                      {sec.sectionHeading}
                    </h5>
                    <div className="space-y-3">
                      {sec.points.map((pt, pIdx) => (
                        <div key={pIdx} className="text-xs space-y-1">
                          <strong className="block font-semibold">{pt.title}</strong>
                          <p className="opacity-80 leading-relaxed">{pt.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-500/5 border-t border-slate-700/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveArticle(null)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white text-xs font-semibold"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
