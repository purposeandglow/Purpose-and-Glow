import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Check, ShieldCheck } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string | React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    id: 'ats',
    question: 'How does ATS (Applicant Tracking System) optimization actually work?',
    answer:
      'Many online applications pass through an ATS before a human recruiter ever sees them. Purpose & Glow builds clean, single-column or standards-compliant semantic structures with standardized headers (Professional Experience, Education, Technical Skills), eliminating text boxes, floating tables, and complex graphics that cause ATS parsing errors. We also align your terminology with keywords commonly searched in your target industry.'
  },
  {
    id: 'guarantee',
    question: 'Do you guarantee that I will get a job or interview?',
    answer:
      'We do not make false guarantees of hiring outcomes because hiring decisions depend on market conditions, company budgets, and interviewer preferences. What Purpose & Glow DOES guarantee is a high-impact, professional presentation that accurately highlights your accomplishments, removes duty-list clutter, passes modern ATS parsers, and positions you at the highest competitive level for your experience.'
  },
  {
    id: 'revamp-vs-scratch',
    question: 'What is the difference between a Résumé Revamp ($99) and Created From Scratch ($145)?',
    answer:
      'The Résumé Revamp ($99) is designed for clients who already have a draft or existing résumé and need it completely rewritten into quantifiable achievement bullets, reformatted, and modernized. Created From Scratch ($145) is for clients who do not have an active résumé, are returning to the workforce after a gap, or have 8–15+ years of complex multi-industry experience requiring deep collaborative synthesis.'
  },
  {
    id: 'turnaround',
    question: 'What is your turnaround time?',
    answer:
      'Standard turnaround for a Résumé Revamp is 24–48 business hours. For Created From Scratch and multi-piece packages (like the Fresh Start Package), turnaround is typically 3–5 business days to ensure thoughtful review and collaborative refinement. Rush delivery is available upon request for urgent application deadlines.'
  },
  {
    id: 'formats',
    question: 'What file formats will I receive when my résumé is finished?',
    answer:
      'You will receive both a fully editable Microsoft Word (.docx) document so you can easily customize details for future applications, as well as a presentation-ready, high-resolution PDF document formatted cleanly for direct email submissions and print.'
  },
  {
    id: 'free-advice',
    question: 'Can I get honest advice before committing to a paid package?',
    answer:
      'Yes, absolutely! We offer a 100% Free Career & Résumé Assessment ($0) and Free DIY Recommendations. You can submit your current background or questions and receive personal recommendations on what to improve. There is zero obligation to purchase any paid service.'
  },
  {
    id: 'remote',
    question: 'Do you work with clients outside of Minnesota?',
    answer:
      'Yes! While Purpose & Glow is proudly founded in Minnesota, we serve clients remotely across all 50 US states. Consultations, intake reviews, and revisions take place seamlessly via email, phone, and optional video conferencing (Google Meet/Zoom).'
  },
  {
    id: 'payments',
    question: 'How does payment work and what payment methods do you accept?',
    answer:
      'We accept Apple Pay, Venmo, and secure digital invoices powered by Square. Payment is completed before the final unwatermarked files are delivered. We never charge recurring subscriptions or hidden administrative fees.'
  }
];

interface FaqAccordionProps {
  isDarkMode?: boolean;
}

export function FaqAccordion({ isDarkMode = false }: FaqAccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>(['ats', 'revamp-vs-scratch']);

  const toggleFaq = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <section className="block" id="faq" data-sect data-label="Frequently Asked Questions" aria-labelledby="faqTitle">
      <div className="wrap">
        <div className="sh">
          <p className="label red">
            <span>Frequently Asked Questions</span>
            <span>Honest &amp; Transparent</span>
          </p>
          <h2 id="faqTitle">
            Everything You Need <em>To Know</em>
          </h2>
          <p>
            Clear answers about turnaround times, ATS compliance, guarantees, and how we collaborate together.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-3 mt-6">
          {FAQS.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isDarkMode
                    ? 'bg-[#121624] border-slate-800'
                    : 'bg-white border-[#fce8f0]'
                } ${isOpen ? 'ring-1 ring-pink-500/30' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className={`w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base transition-colors ${
                    isOpen ? 'text-[#C2185B] dark:text-pink-400' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-pink-500 shrink-0" />
                    <span>{faq.question}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-pink-500' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div
                    className={`px-5 pb-5 pt-1 text-xs sm:text-sm leading-relaxed border-t ${
                      isDarkMode
                        ? 'border-slate-800/80 text-slate-300'
                        : 'border-pink-100/60 text-slate-700'
                    }`}
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
