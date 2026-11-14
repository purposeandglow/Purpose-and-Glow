import React, { useState, useCallback } from 'react';
import {
  X,
  Sparkles,
  Check,
  Send,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileText,
  Briefcase,
  User,
  Compass,
  ExternalLink,
  Mail,
  Copy
} from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import {
  BUSINESS_CONTACT_EMAIL,
  TALLY_REGISTRATION_URL as HOSTED_TALLY_URL,
  isStaticHostingMode,
  parseJsonApiResponse
} from '../lib/hostingMode';
import { safeCopyToClipboard } from '../utils/clipboard';

const TALLY_REGISTRATION_URL = HOSTED_TALLY_URL || 'https://tally.so/r/q5a1RY';

export interface AssessmentData {
  id?: string;
  fullName: string;
  email: string;
  phone?: string;
  locationState: string;
  educationLevel: string;
  currentTitle: string;
  yearsExperience: string;
  targetTitles: string;
  preferredIndustry: string;
  workStyle: string;
  desiredSalary: string;
  linkedInUrl?: string;
  resumeNotes: string;
  primaryAssistance: string;
  wantsDiyTips: boolean;
  agreedToTerms: boolean;
  timestamp?: string;
}

interface FreeAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (data: AssessmentData) => void;
  onOpenPrivacyPolicy?: () => void;
  isDarkMode?: boolean;
}

export function FreeAssessmentModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  onOpenPrivacyPolicy,
  isDarkMode = false
}: FreeAssessmentModalProps) {
  const staticMode = isStaticHostingMode();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [locationState, setLocationState] = useState('');
  const [educationLevel, setEducationLevel] = useState("Bachelor's Degree");
  const [currentTitle, setCurrentTitle] = useState('');
  const [yearsExperience, setYearsExperience] = useState('6–10 years');
  const [targetTitles, setTargetTitles] = useState('');
  const [preferredIndustry, setPreferredIndustry] = useState('Healthcare / Clinical / Revenue Cycle');
  const [workStyle, setWorkStyle] = useState('Remote');
  const [desiredSalary, setDesiredSalary] = useState('$75,000 – $95,000');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [resumeNotes, setResumeNotes] = useState('');
  const [primaryAssistance, setPrimaryAssistance] = useState('Résumé Revamp ($99) — Modern ATS Optimization');
  const [wantsDiyTips, setWantsDiyTips] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [staticHandoffReady, setStaticHandoffReady] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<AssessmentData | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleCloseSafe = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  const dialogRef = useDialogAccessibility(isOpen, handleCloseSafe, !isSubmitting);

  if (!isOpen) return null;

  const summaryPlainText = `Complimentary Human Career & Résumé Review Request ($0)\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nLocation: ${locationState || 'Minnesota / Remote'}\nCurrent Title: ${currentTitle}\nExperience: ${yearsExperience}\nTarget Job Title(s): ${targetTitles}\nIndustry: ${preferredIndustry}\nEducation: ${educationLevel}\nWork Style & Desired Salary: ${workStyle} | ${desiredSalary}\nLinkedIn: ${linkedInUrl || 'Not provided'}\nPrimary Interest: ${primaryAssistance}\nInclude Free DIY Tips: ${wantsDiyTips ? 'Yes' : 'No'}\n\nCareer Situation & Goals:\n${resumeNotes || '(No additional summary typed)'}`;

  const directMailtoUrl = `mailto:${BUSINESS_CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Complimentary Human Résumé Review ($0) - ${fullName || 'Applicant'}`
  )}&body=${encodeURIComponent(summaryPlainText)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please provide a valid email address so I can send your assessment.');
      return;
    }
    if (!currentTitle.trim()) {
      setErrorMessage('Please provide your current or most recent job title.');
      return;
    }
    if (!targetTitles.trim()) {
      setErrorMessage('Please state your target job title or career direction.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('Please check the confirmation box to authorize your confidential assessment.');
      return;
    }

    setErrorMessage(null);

    const payload: AssessmentData = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      locationState: locationState.trim() || 'Minnesota / Remote',
      educationLevel,
      currentTitle: currentTitle.trim(),
      yearsExperience,
      targetTitles: targetTitles.trim(),
      preferredIndustry,
      workStyle,
      desiredSalary,
      linkedInUrl: linkedInUrl.trim() || undefined,
      resumeNotes: resumeNotes.trim(),
      primaryAssistance,
      wantsDiyTips,
      agreedToTerms,
      timestamp: new Date().toISOString()
    };

    if (staticMode) {
      const prepared: AssessmentData = {
        ...payload,
        id: `assess-handoff-${Date.now()}`
      };
      setSubmittedResult(prepared);
      setStaticHandoffReady(true);
      if (onSubmitSuccess) onSubmitSuccess(prepared);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const parsed = await parseJsonApiResponse<{ error?: string; id?: string; inquiry?: { id?: string } }>(res);
      if (!parsed.ok || !parsed.data) {
        setErrorMessage(
          parsed.isHtmlFallback
            ? 'Web-form storage is offline in static hosting. Please submit your complimentary review via Tally or direct email below.'
            : parsed.data?.error || 'Could not submit your assessment request. Please review your details.'
        );
        return;
      }
      const completed: AssessmentData = {
        ...payload,
        id: parsed.data.id || parsed.data.inquiry?.id || `assess-${Date.now()}`
      };
      setSubmittedResult(completed);
      setIsSubmitted(true);
      if (onSubmitSuccess) onSubmitSuccess(completed);
    } catch {
      setErrorMessage(
        'Unable to reach the server right now. Please submit confidentially via Tally or your email app.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setCurrentTitle('');
    setTargetTitles('');
    setResumeNotes('');
    setAgreedToTerms(false);
    setIsSubmitted(false);
    setStaticHandoffReady(false);
    setSubmittedResult(null);
    setCopiedSummary(false);
    onClose();
  };

  const handleCopySummary = async () => {
    const ok = await safeCopyToClipboard(summaryPlainText);
    if (ok) {
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-modal-title"
        className={`relative w-full max-w-3xl my-auto rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 outline-none ${
          isDarkMode
            ? 'bg-[#121624] border-pink-500/30 text-slate-100'
            : 'bg-white border-[#fce8f0] text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#6b0f34] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-pink-200" />
            </div>
            <div>
              <div className="text-[10px] tracking-widest uppercase font-semibold text-pink-100">
                100% Free ($0) · No Obligation · Confidential Human Review
              </div>
              <h3 id="assessment-modal-title" className="text-xl font-bold tracking-tight">
                Free Career &amp; Résumé Assessment
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseSafe}
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Close assessment dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {staticHandoffReady ? (
            <div className="py-6 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-pink-500/15 text-[#C2185B] dark:text-pink-300 mx-auto flex items-center justify-center border border-pink-500/30">
                <ExternalLink className="w-7 h-7" />
              </div>
              <h4 className="text-2xl font-bold">Complimentary Human Review ($0) — Finish via Tally or Email</h4>
              <p className="max-w-lg mx-auto text-sm opacity-90 leading-relaxed">
                Thank you, <strong className="font-semibold">{submittedResult?.fullName}</strong>. Your review notes are ready below, and have <strong>not</strong> been uploaded yet on this static website. Please click <strong>Complete Free Review on Tally ($0)</strong> (where you can also upload your résumé confidentially) or send your pre-filled summary directly via email.
              </p>

              <div
                className={`p-4 rounded-xl border text-left text-xs space-y-2 max-w-lg mx-auto ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="opacity-70">Target Direction:</span>
                  <span className="font-semibold">{submittedResult?.targetTitles}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="opacity-70">Experience Level:</span>
                  <span className="font-semibold">{submittedResult?.yearsExperience}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="opacity-70">Service of Interest:</span>
                  <span className="font-semibold">{submittedResult?.primaryAssistance}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3 justify-center">
                <a
                  href={TALLY_REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white font-semibold text-sm hover:opacity-95 shadow-md inline-flex items-center gap-2"
                >
                  <span>Complete Free Review on Tally ($0)</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href={directMailtoUrl}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                    isDarkMode
                      ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send via Email App</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    isDarkMode
                      ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSummary ? 'Summary Copied' : 'Copy Review Summary'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer pt-1"
              >
                Close and return to site
              </button>
            </div>
          ) : isSubmitted ? (
            <div className="py-8 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center border border-emerald-500/30">
                <Check className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-bold text-emerald-500">Assessment Request Received!</h4>
              <p className="max-w-lg mx-auto text-sm opacity-90 leading-relaxed">
                Thank you, <strong className="font-semibold">{submittedResult?.fullName}</strong>. Your complimentary review request has been saved securely for Purpose &amp; Glow Career Solutions (
                <strong className="text-[#C2185B] dark:text-pink-300 underline">{BUSINESS_CONTACT_EMAIL}</strong>).
              </p>
              <div
                className={`p-4 rounded-xl border text-left text-xs space-y-2 max-w-lg mx-auto ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between">
                  <span className="opacity-70">Target Direction:</span>
                  <span className="font-semibold">{submittedResult?.targetTitles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Experience Level:</span>
                  <span className="font-semibold">{submittedResult?.yearsExperience}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Service of Interest:</span>
                  <span className="font-semibold">{submittedResult?.primaryAssistance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Turnaround Expectation:</span>
                  <span className="font-semibold text-[#C2185B] dark:text-pink-300">Within 24–48 Business Hours</span>
                </div>
              </div>
              <p className="text-xs opacity-75">
                I will personally review your background and send your free recommendations with actionable résumé suggestions.
              </p>
              <div className="pt-3 flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white font-medium text-sm hover:opacity-95 shadow-md cursor-pointer"
                >
                  Close &amp; Return to Site
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Introduction Note */}
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
                  isDarkMode ? 'bg-pink-950/25 border-pink-900/40 text-pink-100' : 'bg-[#fff5f8] border-pink-200 text-pink-950'
                }`}
              >
                <Compass className="w-5 h-5 text-[#C2185B] dark:text-pink-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <div>
                    <strong className="font-semibold">Complimentary Feedback &amp; Honest Expectations ($0):</strong> Your initial human feedback, career recommendations, and job search registration guidance are 100% free with no obligation. Paid résumé writing and coaching services are optional and quoted transparently. Free reviews provide guidance only and do not guarantee interviews, employment, or job placement.
                  </div>
                  {staticMode && (
                    <div>
                      <strong>How Submissions Work Today:</strong> Complete the checklist below to prepare your summary and continue seamlessly to our confidential{' '}
                      <a
                        href={TALLY_REGISTRATION_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-semibold text-[#C2185B] dark:text-pink-300"
                      >
                        Free Tally Intake Form ↗
                      </a>{' '}
                      (where you can also attach a résumé file) or email directly.
                    </div>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1: Contact Information */}
              <div>
                <h4 className="text-xs uppercase tracking-widest font-bold text-[#C2185B] dark:text-pink-400 mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> 1. Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="assess-full-name" className="block text-xs font-semibold mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="assess-full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Jordan Miller"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="assess-email" className="block text-xs font-semibold mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="assess-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. jordan.career@gmail.com"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="assess-phone" className="block text-xs font-semibold mb-1">
                      Phone Number <span className="text-xs opacity-70">(Optional)</span>
                    </label>
                    <input
                      id="assess-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(612) 555-0192"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="assess-location" className="block text-xs font-semibold mb-1">
                      State / Location <span className="text-xs opacity-70">(Remote Nationwide)</span>
                    </label>
                    <input
                      id="assess-location"
                      type="text"
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      placeholder="e.g. Minnesota, Texas, California..."
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Current Background & Target Direction */}
              <div>
                <h4 className="text-xs uppercase tracking-widest font-bold text-[#C2185B] dark:text-pink-400 mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> 2. Career Experience &amp; Target Direction
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="assess-current-title" className="block text-xs font-semibold mb-1">
                      Current or Most Recent Job Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="assess-current-title"
                      type="text"
                      required
                      value={currentTitle}
                      onChange={(e) => setCurrentTitle(e.target.value)}
                      placeholder="e.g. Patient Access Specialist / Account Rep"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="assess-years-exp" className="block text-xs font-semibold mb-1">
                      Total Years of Work Experience
                    </label>
                    <select
                      id="assess-years-exp"
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="Under 2 years (Entry / New Grad)">Under 2 years (Entry / New Grad)</option>
                      <option value="2–5 years (Early Professional)">2–5 years (Early Professional)</option>
                      <option value="6–10 years (Mid-Level)">6–10 years (Mid-Level)</option>
                      <option value="10–15 years (Senior / Lead)">10–15 years (Senior / Lead)</option>
                      <option value="15+ years (Executive / Deep Tenure)">15+ years (Executive / Deep Tenure)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assess-target-titles" className="block text-xs font-semibold mb-1">
                      Target Job Title(s) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="assess-target-titles"
                      type="text"
                      required
                      value={targetTitles}
                      onChange={(e) => setTargetTitles(e.target.value)}
                      placeholder="e.g. Revenue Cycle Manager / Clinical Supervisor"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="assess-industry" className="block text-xs font-semibold mb-1">
                      Preferred Industry
                    </label>
                    <select
                      id="assess-industry"
                      value={preferredIndustry}
                      onChange={(e) => setPreferredIndustry(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="Healthcare / Clinical / Revenue Cycle">Healthcare / Clinical / Revenue Cycle</option>
                      <option value="Business Operations / Administration">Business Operations / Administration</option>
                      <option value="Finance / Accounting / Insurance">Finance / Accounting / Insurance</option>
                      <option value="Human Resources / Talent Acquisition">Human Resources / Talent Acquisition</option>
                      <option value="Tech / IT / Systems Support">Tech / IT / Systems Support</option>
                      <option value="Education / Non-Profit / Public Sector">Education / Non-Profit / Public Sector</option>
                      <option value="Career Transition / Undecided">Career Transition / Open to Recommendations</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assess-education" className="block text-xs font-semibold mb-1">
                      Highest Education / Credential
                    </label>
                    <select
                      id="assess-education"
                      value={educationLevel}
                      onChange={(e) => setEducationLevel(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="High School / GED">High School / GED</option>
                      <option value="Associate Degree / Vocational Diploma">Associate Degree / Vocational Diploma</option>
                      <option value="Bachelor's Degree">Bachelor's Degree</option>
                      <option value="Master's / Graduate Degree">Master's / Graduate Degree</option>
                      <option value="Doctorate / Professional JD/MD">Doctorate / Professional JD/MD</option>
                      <option value="Industry Certifications (CPC, PMP, SHRM, RHIA, etc.)">Industry Certifications (CPC, PMP, SHRM, etc.)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assess-work-style" className="block text-xs font-semibold mb-1">
                      Work Preference &amp; Desired Salary
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        id="assess-work-style"
                        aria-label="Work preference"
                        value={workStyle}
                        onChange={(e) => setWorkStyle(e.target.value)}
                        className={`w-full px-2.5 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="Remote">Remote</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Onsite">Onsite</option>
                        <option value="Open to Any">Open to Any</option>
                      </select>
                      <select
                        id="assess-desired-salary"
                        aria-label="Desired salary range"
                        value={desiredSalary}
                        onChange={(e) => setDesiredSalary(e.target.value)}
                        className={`w-full px-2.5 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="$45,000 – $60,000">$45k – $60k</option>
                        <option value="$60,000 – $80,000">$60k – $80k</option>
                        <option value="$80,000 – $105,000">$80k – $105k</option>
                        <option value="$105,000 – $140,000">$105k – $140k</option>
                        <option value="$140,000+">$140k+</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Résumé Context & Primary Assistance */}
              <div>
                <h4 className="text-xs uppercase tracking-widest font-bold text-[#C2185B] dark:text-pink-400 mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> 3. Résumé Details &amp; Service Interest
                </h4>

                <div className="space-y-3.5">
                  <div>
                    <label htmlFor="assess-linkedin" className="block text-xs font-semibold mb-1">
                      LinkedIn URL <span className="text-xs opacity-70">(Optional, helps me review your work history)</span>
                    </label>
                    <input
                      id="assess-linkedin"
                      type="url"
                      value={linkedInUrl}
                      onChange={(e) => setLinkedInUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/in/your-profile"
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="assess-primary-service" className="block text-xs font-semibold mb-1">
                      Primary Service You Are Exploring
                    </label>
                    <select
                      id="assess-primary-service"
                      value={primaryAssistance}
                      onChange={(e) => setPrimaryAssistance(e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="Free DIY Recommendations ($0) — 3 Core Pointers">Free DIY Résumé Recommendations ($0) — 3 Actionable Pointers</option>
                      <option value="Résumé Revamp ($99) — Modern ATS Optimization">Résumé Revamp ($99) — Modern ATS Optimization (Most Popular)</option>
                      <option value="Résumé From Scratch ($145) — In-Depth 8-15+ Year Career Pivot">Résumé From Scratch ($145) — In-Depth 8-15+ Year Career Pivot</option>
                      <option value="Student Résumé ($50) — New Graduates & Entry-Level">Student Résumé ($50) — New Graduates &amp; Entry-Level</option>
                      <option value="Targeted Cover Letter ($49) — Custom Role-Specific">Targeted Cover Letter ($49) — Custom Role-Specific</option>
                      <option value="Job-Specific Résumé Tailoring ($45) — Single Posting Optimization">Job-Specific Résumé Tailoring ($45) — Single Posting Optimization</option>
                      <option value="Interview Preparation ($65) — 1-on-1 Practice">Interview Preparation ($65) — 45-Min Session &amp; Guide</option>
                      <option value="Career Ready Package ($189) — Résumé + Cover Letter + Prep">Career Ready Package ($189) — Revamp + Cover Letter + Prep</option>
                      <option value="Fresh Start Package ($239) — Complete Career Bundle">Fresh Start Package ($239) — From Scratch + Cover Letter + Prep</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assess-notes" className="block text-xs font-semibold mb-1">
                      Tell me about your current situation or career goals
                    </label>
                    <textarea
                      id="assess-notes"
                      rows={3}
                      maxLength={1800}
                      value={resumeNotes}
                      onChange={(e) => setResumeNotes(e.target.value)}
                      placeholder="e.g. I’ve been applying for 3 months with little response. My current résumé feels like a job description rather than showing my accomplishments..."
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <p className="mt-1.5 text-[11px] opacity-80">
                      For your privacy, please summarize your goals here rather than pasting a full résumé. If a résumé file is needed for your complimentary human review, upload it confidentially via our{' '}
                      <a
                        href={TALLY_REGISTRATION_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#C2185B] dark:text-pink-300 hover:underline font-semibold"
                      >
                        Tally Intake Form
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Checkboxes & Consent */}
              <div className="space-y-2.5 pt-1">
                <label htmlFor="assess-diy-tips" className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    id="assess-diy-tips"
                    type="checkbox"
                    checked={wantsDiyTips}
                    onChange={(e) => setWantsDiyTips(e.target.checked)}
                    className="mt-0.5 rounded accent-[#C2185B]"
                  />
                  <span>
                    Include <strong>Free DIY Résumé Recommendations</strong> showing actionable duty-to-metric formula examples.
                  </span>
                </label>

                <label htmlFor="assess-terms" className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    id="assess-terms"
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded accent-[#C2185B]"
                  />
                  <span>
                    <strong className="text-rose-500">*</strong> I agree to share these details so Purpose &amp; Glow Career Solutions ({BUSINESS_CONTACT_EMAIL}) can respond to my complimentary review request.{' '}
                    {onOpenPrivacyPolicy && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenPrivacyPolicy();
                        }}
                        className="underline font-semibold text-[#C2185B] dark:text-pink-300 cursor-pointer"
                      >
                        Read Privacy Policy
                      </button>
                    )}
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-slate-700/20">
                <div className="text-[11px] opacity-80 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  Your information is private and never sold or traded.
                </div>

                <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCloseSafe}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-400/40 text-xs font-semibold hover:bg-slate-500/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#801040] text-white text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{staticMode ? 'Prepare Free Tally / Email Review ($0)' : 'Submit Free Assessment ($0)'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
