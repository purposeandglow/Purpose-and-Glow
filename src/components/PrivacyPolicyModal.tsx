import React from 'react';
import { ShieldCheck, X, Lock, Mail, ExternalLink } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { BUSINESS_CONTACT_EMAIL, TALLY_REGISTRATION_URL } from '../lib/hostingMode';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export function PrivacyPolicyModal({
  isOpen,
  onClose,
  isDarkMode = false
}: PrivacyPolicyModalProps) {
  const dialogRef = useDialogAccessibility(isOpen, onClose, true);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-policy-title"
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl my-auto rounded-2xl border shadow-2xl overflow-hidden outline-none ${
          isDarkMode
            ? 'bg-[#121624] border-pink-500/30 text-slate-100'
            : 'bg-white border-pink-200 text-slate-900'
        }`}
      >
        <div className="px-5 py-4 bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#7B0E3D] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-pink-100 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-pink-100">
                Purpose &amp; Glow Career Solutions
              </p>
              <h2 id="privacy-policy-title" className="text-lg font-bold tracking-tight">
                Privacy Policy &amp; Data Practices
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy policy dialog"
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-5 text-xs sm:text-sm leading-relaxed">
          <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
            Purpose &amp; Glow Career Solutions respects your privacy. This notice describes only the information we actually collect, the third-party tools used on this website, and how you can request updates or deletion of your information.
          </p>

          <section className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#C2185B] dark:text-pink-300">
              1. Information You Choose to Share
            </h3>
            <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
              Browsing this website does not require an account or login. When you choose to request a consultation, register for free job search guidance, or request a complimentary human résumé review, you voluntarily provide contact and career details (such as your name, email address, phone number if optional, target role, and career notes). Please do not paste confidential full résumés into general inquiry forms; confidential résumé files are accepted through our dedicated Tally intake form.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#C2185B] dark:text-pink-300">
              2. How Your Information Is Used
            </h3>
            <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
              Your submitted details are used solely to respond to your inquiry, provide requested career guidance or résumé services, and schedule consultations. Purpose &amp; Glow Career Solutions does not sell, rent, or trade visitor personal information to third parties, and free guidance or reviews do not guarantee interviews, job offers, or employment outcomes.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#C2185B] dark:text-pink-300">
              3. Third-Party Services Used on This Site
            </h3>
            <ul className={`list-disc pl-5 space-y-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <li>
                <strong>Tally (<a href={TALLY_REGISTRATION_URL} target="_blank" rel="noopener noreferrer" className="underline text-[#C2185B] dark:text-pink-300 inline-flex items-center gap-0.5">tally.so <ExternalLink className="w-3 h-3" /></a>):</strong> Used for free job search registration and confidential résumé uploads. Submissions made in Tally are governed by Tally’s privacy and security practices.
              </li>
              <li>
                <strong>Calendly:</strong> Used when you choose to book an optional 15-minute consultation call.
              </li>
              <li>
                <strong>Google Forms:</strong> Provided as an optional external intake link in our contact section.
              </li>
              <li>
                <strong>Firebase Hosting &amp; Authentication:</strong> Used to host the public website and authenticate the private administrator account. Public automated AI résumé assessment is currently paused (<code>PUBLIC_AI_ENABLED=false</code>), so visitor résumés are not submitted to automated AI APIs from the public website.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#C2185B] dark:text-pink-300">
              4. Browser Local Storage (On Your Device)
            </h3>
            <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
              This website uses your browser’s local storage strictly for convenience preferences: light/dark display theme, starred résumé examples, announcement banner dismissal, and an optional on-device reminder of inquiries you initiated. We avoid storing sensitive résumé text or applicant email addresses in public browser storage, and you can clear your saved device inquiry history anytime using the <strong>Clear History</strong> button in the Contact section.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-sm text-[#C2185B] dark:text-pink-300">
              5. Your Privacy Rights &amp; Contact
            </h3>
            <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
              To ask questions about your submitted information or request correction or deletion of any inquiry records you sent to Purpose &amp; Glow Career Solutions, email{' '}
              <a
                href={`mailto:${BUSINESS_CONTACT_EMAIL}?subject=Privacy%20%2F%20Data%20Request`}
                className="underline font-semibold text-[#C2185B] dark:text-pink-300 inline-flex items-center gap-1"
              >
                <Mail className="w-3.5 h-3.5" />
                {BUSINESS_CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between gap-3 ${
            isDarkMode ? 'bg-[#0E111B] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span className="text-[11px] flex items-center gap-1.5 opacity-75">
            <Lock className="w-3.5 h-3.5 text-[#C2185B] dark:text-pink-300" />
            Privacy-First Career Consulting · Updated Nov 2026
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
