import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  EyeOff,
  FileText,
  FileUp,
  Info,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  ExternalLink
} from 'lucide-react';
import { parseResumeFile } from '../lib/resumeParser';
import { redactContactPii } from '../lib/piiRedactor';
import {
  MAX_JOB_DESC_CHARS,
  MAX_RESUME_CHARS,
  MIN_RESUME_CHARS,
  type StructuredResumeAssessment
} from '../lib/assessmentConstants';
import { formatAssessmentForClipboard } from '../lib/assessmentFormatter';
import { safeCopyToClipboard } from '../utils/clipboard';
import type { ServiceInterestKey } from '../lib/assessmentMetrics';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import {
  TALLY_REGISTRATION_URL,
  isStaticHostingMode,
  parseJsonApiResponse
} from '../lib/hostingMode';

interface PublicAssessmentStatus {
  publicAiEnabled: boolean;
  turnstileConfigured: boolean;
  turnstileSiteKey: string | null;
  maxFileBytes: number;
  minChars: number;
  maxChars: number;
  maxJobDescChars: number;
  limits: {
    hourlyIpLimit: number;
    dailyIpLimit: number;
    dailyGlobalLimit: number;
    monthlyGlobalLimit: number;
  };
  tallyUrl: string;
}

interface PublicResumeAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToHumanAssessment: () => void;
  onSelectService?: (serviceLabel: string) => void;
  onOpenPrivacyPolicy?: () => void;
  isDarkMode?: boolean;
  adminAuthToken?: string | null;
}

const SERVICE_EXPLORATION_CARDS: Array<{
  key: ServiceInterestKey;
  label: string;
  price: string;
  desc: string;
  selectValue: string;
}> = [
  {
    key: 'student_50',
    label: 'Student & Early Career',
    price: '$50',
    desc: 'Coursework, capstones, and internships framed clearly for early-career hiring.',
    selectValue: 'Student & Early Career Résumé — $50'
  },
  {
    key: 'revamp_99',
    label: 'Résumé Revamp',
    price: '$99',
    desc: 'Contribution-focused revision, stronger wording, and clean formatting for existing résumés.',
    selectValue: 'Professional Résumé Revamp — $99'
  },
  {
    key: 'scratch_145',
    label: 'Created From Scratch',
    price: '$145',
    desc: 'Ground-up narrative and layout for 8–15+ year careers or major pivots.',
    selectValue: 'Created From Scratch — $145'
  },
  {
    key: 'tailoring_45',
    label: 'Job-Specific Tailoring',
    price: '$45',
    desc: 'Targeted positioning and keyword alignment tailored to one specific posting.',
    selectValue: 'Job-Specific Résumé Tailoring — $45'
  },
  {
    key: 'cover_letter_49',
    label: 'Targeted Cover Letter',
    price: '$49',
    desc: 'Authentic, personalized cover letter tailored to your target role and employer.',
    selectValue: 'Targeted Cover Letter — $49'
  },
  {
    key: 'interview_65',
    label: 'Interview Preparation',
    price: '$65',
    desc: '45-minute 1-on-1 mock interview practice session with personalized story prep.',
    selectValue: 'Interview Preparation Session — $65'
  }
];

async function sendAnonymousEvent(eventKey: ServiceInterestKey) {
  if (isStaticHostingMode()) return;
  try {
    await fetch('/api/public/assessment-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventKey })
    });
  } catch {
    // Non-blocking anonymous telemetry
  }
}

export function PublicResumeAssessmentModal({
  isOpen,
  onClose,
  onSwitchToHumanAssessment,
  onSelectService,
  onOpenPrivacyPolicy,
  isDarkMode = false,
  adminAuthToken = null
}: PublicResumeAssessmentModalProps) {
  const staticMode = isStaticHostingMode();
  const [status, setStatus] = useState<PublicAssessmentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [rawText, setRawText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [redactPiiEnabled, setRedactPiiEnabled] = useState(true);
  const [redactionCount, setRedactionCount] = useState(0);

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [targetJobTitle, setTargetJobTitle] = useState('');
  const [industry, setIndustry] = useState('Healthcare / Clinical / Revenue Cycle');
  const [jobDescription, setJobDescription] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<StructuredResumeAssessment | null>(null);
  const [adminPreviewNote, setAdminPreviewNote] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  const dialogRef = useDialogAccessibility(isOpen, onClose, !isSubmitting);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatusError(null);

    if (staticMode) {
      setStatus({
        publicAiEnabled: false,
        turnstileConfigured: false,
        turnstileSiteKey: null,
        maxFileBytes: 5 * 1024 * 1024,
        minChars: MIN_RESUME_CHARS,
        maxChars: MAX_RESUME_CHARS,
        maxJobDescChars: MAX_JOB_DESC_CHARS,
        limits: {
          hourlyIpLimit: 2,
          dailyIpLimit: 4,
          dailyGlobalLimit: 40,
          monthlyGlobalLimit: 600
        },
        tallyUrl: TALLY_REGISTRATION_URL
      });
      return;
    }

    fetch('/api/public/assessment-status')
      .then((res) => parseJsonApiResponse<PublicAssessmentStatus>(res))
      .then((parsed) => {
        if (!cancelled) {
          if (parsed.ok && parsed.data) {
            setStatus(parsed.data);
          } else {
            setStatus({
              publicAiEnabled: false,
              turnstileConfigured: false,
              turnstileSiteKey: null,
              maxFileBytes: 5 * 1024 * 1024,
              minChars: MIN_RESUME_CHARS,
              maxChars: MAX_RESUME_CHARS,
              maxJobDescChars: MAX_JOB_DESC_CHARS,
              limits: {
                hourlyIpLimit: 2,
                dailyIpLimit: 4,
                dailyGlobalLimit: 40,
                monthlyGlobalLimit: 600
              },
              tallyUrl: TALLY_REGISTRATION_URL
            });
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatusError('Could not load AI availability status. Complimentary Human Review and Tally remain available.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, staticMode]);

  // Render Cloudflare Turnstile widget only when configured on the server
  useEffect(() => {
    if (!isOpen || staticMode || !status?.turnstileConfigured || !status?.turnstileSiteKey) return;
    const container = turnstileContainerRef.current;
    if (!container) return;

    const win = window as any;
    let widgetId: string | null = null;

    const renderWidget = () => {
      if (win.turnstile && container) {
        container.innerHTML = '';
        widgetId = win.turnstile.render(container, {
          sitekey: status.turnstileSiteKey,
          theme: isDarkMode ? 'dark' : 'light',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null)
        });
      }
    };

    if (win.turnstile) {
      renderWidget();
    } else if (!document.getElementById('cf-turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'cf-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetId && win.turnstile?.remove) {
        try {
          win.turnstile.remove(widgetId);
        } catch {}
      }
    };
  }, [isOpen, staticMode, status?.turnstileConfigured, status?.turnstileSiteKey, isDarkMode]);

  if (!isOpen) return null;

  const applyPiiToggle = (nextRaw: string, shouldRedact: boolean) => {
    const bounded = nextRaw.slice(0, MAX_RESUME_CHARS);
    if (shouldRedact) {
      const res = redactContactPii(bounded);
      setReviewText(res.redactedText);
      setRedactionCount(res.totalRedactions);
    } else {
      setReviewText(bounded);
      setRedactionCount(0);
    }
  };

  const handleTogglePiiMask = (checked: boolean) => {
    setRedactPiiEnabled(checked);
    applyPiiToggle(rawText || reviewText, checked);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setSubmitError(null);
    setUploadedFileName(file.name);
    setIsParsingFile(true);

    try {
      const parsed = await parseResumeFile(file);
      if (!parsed.ok || !parsed.rawExtractedText) {
        setParseError(
          parsed.errorMessage ||
            'Could not extract readable text from this file. Please try pasting your résumé text instead.'
        );
        return;
      }

      setRawText(parsed.rawExtractedText);
      if (redactPiiEnabled) {
        setReviewText(parsed.redactedText || parsed.rawExtractedText);
        setRedactionCount(parsed.totalRedactions || 0);
      } else {
        setReviewText(parsed.rawExtractedText);
        setRedactionCount(0);
      }
    } finally {
      setIsParsingFile(false);
    }
  };

  const handlePasteChange = (value: string) => {
    setParseError(null);
    setRawText(value);
    applyPiiToggle(value, redactPiiEnabled);
  };

  const validateBeforeSubmit = () => {
    if (!targetJobTitle.trim() || targetJobTitle.trim().length < 2) {
      setSubmitError('Please enter your target job title or career direction.');
      return false;
    }
    const len = reviewText.trim().length;
    if (len < MIN_RESUME_CHARS) {
      setSubmitError(
        `Please include at least ${MIN_RESUME_CHARS} characters of résumé content (currently ${len}).`
      );
      return false;
    }
    if (len > MAX_RESUME_CHARS) {
      setSubmitError(`Please shorten the résumé text to ${MAX_RESUME_CHARS.toLocaleString()} characters or less.`);
      return false;
    }
    if (!consentChecked) {
      setSubmitError('Please check the explicit AI processing & accuracy disclosure box before submitting.');
      return false;
    }
    return true;
  };

  const handleSubmitPublicAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setAdminPreviewNote(null);
    if (staticMode || publicPaused) {
      setSubmitError(
        'Public AI résumé processing is paused on this hosting setup. Personal human review ($0) and Tally registration remain open.'
      );
      return;
    }
    if (!validateBeforeSubmit()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/public/resume-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: reviewText.trim(),
          targetJobTitle: targetJobTitle.trim(),
          industry,
          jobDescription: jobDescription.trim() || undefined,
          consentGiven: true,
          turnstileToken: turnstileToken || undefined
        })
      });

      const parsed = await parseJsonApiResponse<{ error?: string; assessment?: StructuredResumeAssessment }>(res);
      if (!parsed.ok || !parsed.data?.assessment) {
        setSubmitError(
          parsed.data?.error ||
            'Unable to run the AI assessment right now. Personal human review and Tally registration remain available.'
        );
        return;
      }

      setAssessmentResult(parsed.data.assessment);
      setCopiedFeedback(false);
    } catch {
      setSubmitError('Network error while connecting to the assessment service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminPreviewTest = async () => {
    if (!adminAuthToken) return;
    setSubmitError(null);
    setAdminPreviewNote(null);
    if (staticMode) {
      setSubmitError('Admin AI preview requires the Express API backend, which is not active on static Firebase Hosting.');
      return;
    }
    if (!validateBeforeSubmit()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/assessments/preview-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuthToken}`
        },
        body: JSON.stringify({
          resumeText: reviewText.trim(),
          targetJobTitle: targetJobTitle.trim(),
          industry,
          jobDescription: jobDescription.trim() || undefined
        })
      });
      const parsed = await parseJsonApiResponse<{
        error?: string;
        assessment?: StructuredResumeAssessment;
        publicAiEnabled?: boolean;
      }>(res);
      if (!parsed.ok || !parsed.data?.assessment) {
        setSubmitError(parsed.data?.error || 'Admin preview test could not complete.');
        return;
      }
      setAssessmentResult(parsed.data.assessment);
      setCopiedFeedback(false);
      setAdminPreviewNote(
        `Verified Admin Preview Mode (PUBLIC_AI_ENABLED remains ${parsed.data.publicAiEnabled ? 'true' : 'false'} for public visitors).`
      );
    } catch {
      setSubmitError('Failed to execute Admin preview test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAssessmentResult(null);
    setSubmitError(null);
    setAdminPreviewNote(null);
    setConsentChecked(false);
    setCopiedFeedback(false);
  };

  const handleCopyFeedback = async () => {
    if (!assessmentResult) return;
    const text = formatAssessmentForClipboard(assessmentResult, targetJobTitle);
    const copied = await safeCopyToClipboard(text);
    if (copied) {
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 3000);
    }
  };

  const handleCopySummaryOnly = async () => {
    if (!assessmentResult) return;
    const summaryText =
      assessmentResult.readyToAdaptSummary ||
      (assessmentResult.professionalSummarySuggestions[0] || '')
        .replace(/^Ready-to-Adapt\s+Summary:\s*/i, '')
        .replace(/^["“']+|["”']+$/g, '')
        .trim();
    if (!summaryText) return;
    const copied = await safeCopyToClipboard(summaryText);
    if (copied) {
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 3000);
    }
  };

  const charCount = reviewText.trim().length;
  const publicPaused = status ? !status.publicAiEnabled : true;

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
        aria-labelledby="public-ai-assessment-title"
        className={`relative w-full max-w-3xl my-auto rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 outline-none ${
          isDarkMode
            ? 'bg-[#121624] border-pink-500/30 text-slate-100'
            : 'bg-white border-[#fce8f0] text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#6b0f34] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
              <Sparkles className="w-5 h-5 text-pink-200" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] tracking-widest uppercase font-semibold text-pink-200 truncate">
                Optional Instant AI Feedback · Privacy-First · $0
              </div>
              <h3
                id="public-ai-assessment-title"
                className="text-lg sm:text-xl font-bold tracking-tight truncate"
              >
                AI-Powered Résumé Assessment
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0"
            aria-label="Close AI résumé assessment dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto space-y-5">
          {/* Prefer Human Review Bar */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isDarkMode
                ? 'bg-[#181D2C] border-[#2A3147] text-slate-200'
                : 'bg-[#FFF5F8] border-pink-200 text-slate-800'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-[#C2185B] shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Prefer 1-on-1 Human Review Instead?</strong>{' '}
                <span className="opacity-85">
                  AI feedback is completely optional. Nicole’s complimentary personal review and free Tally registration are always open.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  sendAnonymousEvent('human_review');
                  onClose();
                  onSwitchToHumanAssessment();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Personal Human Review ($0)
              </button>
              <a
                href="https://tally.so/r/q5a1RY"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sendAnonymousEvent('tally_registration')}
                className={`px-3 py-1.5 rounded-lg border font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                  isDarkMode
                    ? 'border-pink-500/40 text-pink-300 hover:bg-pink-950/40'
                    : 'border-pink-300 text-[#9C1450] hover:bg-pink-100/70'
                }`}
              >
                <span>Free Tally Form</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {statusError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {publicPaused && !assessmentResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                isDarkMode
                  ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Public AI Access Paused Pre-Launch (PUBLIC_AI_ENABLED = false)
                </p>
                <p className="opacity-90 leading-relaxed">
                  You can test uploading a PDF/DOCX or redacting personal contact details locally below, or switch right now to our complimentary personal human résumé assessment and Tally registration.
                </p>
              </div>
            </div>
          )}

          {assessmentResult ? (
            <div className="space-y-5">
              {adminPreviewNote && (
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-300 text-xs font-medium">
                  {adminPreviewNote}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-500/20">
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-bold text-[#C2185B] dark:text-pink-400">
                    Grounded Feedback Report
                  </span>
                  <h4 className="text-lg font-bold">
                    Assessment for {targetJobTitle || 'Target Role'}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyFeedback}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      copiedFeedback
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                        : isDarkMode
                        ? 'border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-200'
                        : 'border-pink-300 bg-[#FFF5F8] hover:bg-pink-100 text-[#9C1450]'
                    }`}
                  >
                    {copiedFeedback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFeedback ? 'Copied to Clipboard' : 'Copy Feedback'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                      isDarkMode
                        ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Review Another Résumé
                  </button>
                </div>
              </div>

              {assessmentResult.publicVerificationReminder && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                    isDarkMode
                      ? 'bg-pink-950/25 border-pink-800/40 text-pink-100'
                      : 'bg-[#FFF5F8] border-pink-200 text-slate-800'
                  }`}
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#C2185B]" />
                  <span>{assessmentResult.publicVerificationReminder}</span>
                </div>
              )}

              {/* 1. Overall Evaluation */}
              <section
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-[#FFF5F8]/70 border-pink-200'
                }`}
              >
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#C2185B] dark:text-pink-300">
                  1. Overall Evaluation
                </h5>
                <p className="text-sm leading-relaxed">{assessmentResult.overallEvaluation}</p>
              </section>

              {/* 3. Separated Ready-to-Adapt Professional Summary (Copy-Only Text + Separate Coaching Note) */}
              <section
                className={`p-4 rounded-xl border space-y-2.5 ${
                  isDarkMode ? 'bg-slate-900/45 border-slate-800' : 'bg-white border-pink-200/80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#C2185B] dark:text-pink-300">
                    3. Ready-to-Adapt Professional Summary
                  </h5>
                  <button
                    type="button"
                    onClick={handleCopySummaryOnly}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      copiedSummary
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                        : isDarkMode
                        ? 'border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-200'
                        : 'border-pink-300 bg-[#FFF5F8] hover:bg-pink-100 text-[#9C1450]'
                    }`}
                  >
                    {copiedSummary ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSummary ? 'Summary Copied' : 'Copy Summary Only'}</span>
                  </button>
                </div>
                <p
                  className={`p-3 rounded-lg border text-xs sm:text-sm leading-relaxed font-medium ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  {assessmentResult.readyToAdaptSummary ||
                    (assessmentResult.professionalSummarySuggestions[0] || '')
                      .replace(/^Ready-to-Adapt\s+Summary:\s*/i, '')
                      .replace(/^["“']+|["”']+$/g, '')}
                </p>
                {(assessmentResult.summaryCoachingNote || assessmentResult.professionalSummarySuggestions.length > 1) && (
                  <p className="text-xs opacity-80 leading-relaxed">
                    {assessmentResult.summaryCoachingNote ||
                      assessmentResult.professionalSummarySuggestions.slice(1).join(' ')}
                  </p>
                )}
              </section>

              {/* 2, 4, 5, 6, 7 Structured Sections Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: '2. ATS Compatibility Recommendations',
                    items: assessmentResult.atsCompatibilityRecommendations
                  },
                  {
                    title: '4. Work Experience & Achievement Framing',
                    items: assessmentResult.workExperienceRecommendations
                  },
                  {
                    title: '5. Skills & Keyword Alignment',
                    items: assessmentResult.skillsAndKeywordRecommendations
                  },
                  {
                    title: '6. Formatting & Readability',
                    items: assessmentResult.formattingAndReadabilitySuggestions
                  },
                  {
                    title: '7. Practical Job-Search Next Steps',
                    items: assessmentResult.practicalJobSearchRecommendations
                  }
                ].map((sec) => (
                  <section
                    key={sec.title}
                    className={`p-4 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#C2185B] dark:text-pink-300">
                      {sec.title}
                    </h5>
                    <ul className="space-y-1.5 text-xs leading-relaxed list-disc pl-4">
                      {sec.items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              {/* 8. Before & After Examples */}
              {assessmentResult.beforeAfterExamples.length > 0 && (
                <section className="space-y-2.5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#C2185B] dark:text-pink-300">
                    8. Grounded Before &amp; After Bullet Examples
                  </h5>
                  <div className="space-y-3">
                    {assessmentResult.beforeAfterExamples.map((ex, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                          isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-slate-500 uppercase text-[10px]">
                            From Your Résumé:
                          </span>
                          <p className="mt-0.5 italic opacity-85">{ex.originalContext}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase text-[10px]">
                            Stronger Contribution Example (True to Your Role):
                          </span>
                          <p className="mt-0.5 font-medium">{ex.improvedExample}</p>
                        </div>
                        {ex.whyItWorks && (
                          <p className="text-[11px] opacity-75">Why it works: {ex.whyItWorks}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Suggested Next Steps & Optional Services */}
              <section
                className={`p-4 rounded-xl border space-y-3 ${
                  isDarkMode ? 'bg-[#181D2C] border-pink-500/25' : 'bg-[#FFF5F8] border-pink-200'
                }`}
              >
                <div className="space-y-1">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#C2185B] dark:text-pink-300">
                    Optional Personalized Support from Purpose &amp; Glow
                  </h5>
                  <p className="text-xs leading-relaxed opacity-90">
                    {assessmentResult.suggestedServiceFocus}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                  {SERVICE_EXPLORATION_CARDS.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => {
                        sendAnonymousEvent(card.key);
                        if (onSelectService) {
                          onClose();
                          onSelectService(card.selectValue);
                        }
                      }}
                      className={`flex flex-col justify-between h-full p-3.5 rounded-xl border text-left transition-all cursor-pointer gap-2 ${
                        isDarkMode
                          ? 'bg-slate-900/70 border-slate-700 hover:border-pink-400'
                          : 'bg-white border-pink-200/80 hover:border-[#C2185B]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <span className="text-xs font-bold leading-snug min-h-[2rem]">
                          {card.label}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#C2185B] dark:text-pink-300 tabular-nums shrink-0">
                          {card.price}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-85 leading-relaxed flex-1">
                        {card.desc}
                      </p>
                      <span className="text-[11px] font-semibold text-[#C2185B] dark:text-pink-300 inline-flex items-center gap-1 pt-0.5">
                        <span>Explore service</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="https://tally.so/r/q5a1RY"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sendAnonymousEvent('tally_registration')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Register Free on Tally ($0)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      sendAnonymousEvent('human_review');
                      onClose();
                      onSwitchToHumanAssessment();
                    }}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                      isDarkMode
                        ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-800 hover:bg-white'
                    }`}
                  >
                    Request Human Review ($0)
                  </button>
                </div>
              </section>

              {/* Mandatory Accuracy & Non-Guarantee Disclaimer */}
              <div
                className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                  isDarkMode
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <strong>Important Notice:</strong> {assessmentResult.disclaimer}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitPublicAssessment} className="space-y-4">
              {/* Upload vs Paste Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className={`inline-flex rounded-xl p-1 border ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      inputMode === 'upload'
                        ? 'bg-[#C2185B] text-white shadow-xs'
                        : isDarkMode
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Upload PDF or Word (.docx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      inputMode === 'paste'
                        ? 'bg-[#C2185B] text-white shadow-xs'
                        : isDarkMode
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Paste Résumé Text</span>
                  </button>
                </div>

                {/* Default-ON PII Redaction Toggle */}
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={redactPiiEnabled}
                    onChange={(e) => handleTogglePiiMask(e.target.checked)}
                    className="rounded accent-[#C2185B]"
                  />
                  <EyeOff className="w-3.5 h-3.5 text-[#C2185B]" />
                  <span>Redact personal contact info (Default On)</span>
                </label>
              </div>

              {inputMode === 'upload' && (
                <div
                  className={`p-4 rounded-xl border border-dashed text-center space-y-2 ${
                    isDarkMode
                      ? 'bg-slate-900/50 border-slate-700 hover:border-pink-400'
                      : 'bg-slate-50 border-pink-300 hover:border-[#C2185B]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                    onChange={handleFileChange}
                    className="hidden"
                    id="public-resume-file-input"
                  />
                  <p className="text-xs font-semibold">
                    {isParsingFile
                      ? 'Extracting text locally inside your browser...'
                      : uploadedFileName
                      ? `Loaded locally: ${uploadedFileName}`
                      : 'Select your résumé (.pdf or .docx, max 5 MB)'}
                  </p>
                  <p className="text-[11px] opacity-75">
                    Text extraction &amp; contact redaction run directly inside your browser before anything is transmitted.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsingFile}
                    className="px-4 py-2 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>{uploadedFileName ? 'Choose Another File' : 'Select Résumé File'}</span>
                  </button>
                </div>
              )}

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Target Role & Industry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="ai-target-title" className="block text-xs font-semibold mb-1">
                    Target Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ai-target-title"
                    type="text"
                    required
                    value={targetJobTitle}
                    onChange={(e) => setTargetJobTitle(e.target.value)}
                    placeholder="e.g. Revenue Cycle Specialist / Clinic Supervisor"
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="ai-industry" className="block text-xs font-semibold mb-1">
                    Target Industry
                  </label>
                  <select
                    id="ai-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Healthcare / Clinical / Revenue Cycle">Healthcare / Clinical / Revenue Cycle</option>
                    <option value="Operations & Practice Management">Operations &amp; Practice Management</option>
                    <option value="Business Administration & Finance">Business Administration &amp; Finance</option>
                    <option value="Human Resources & Compliance">Human Resources &amp; Compliance</option>
                    <option value="IT / Systems & Analytics">IT / Systems &amp; Analytics</option>
                    <option value="Career Pivot / Multiple Industries">Career Pivot / Open</option>
                    <option value="Student / Recent Graduate">Student / Recent Graduate</option>
                  </select>
                </div>
              </div>

              {/* Review / Edit Text Before Submission */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label htmlFor="ai-resume-review-text" className="text-xs font-semibold">
                    Review Your Text Before Submitting <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    {redactionCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold">
                        {redactionCount} contact detail{redactionCount === 1 ? '' : 's'} masked
                      </span>
                    )}
                    <span className="font-mono opacity-70">
                      {charCount.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} chars
                    </span>
                  </div>
                </div>
                <textarea
                  id="ai-resume-review-text"
                  rows={6}
                  value={reviewText}
                  onChange={(e) => {
                    if (inputMode === 'paste') {
                      handlePasteChange(e.target.value);
                    } else {
                      setReviewText(e.target.value.slice(0, MAX_RESUME_CHARS));
                    }
                  }}
                  placeholder={
                    inputMode === 'upload'
                      ? 'Uploaded résumé text will appear here for your inspection and editing before submission...'
                      : 'Paste your résumé summary, experience bullets, and skills here (minimum 150 characters)...'
                  }
                  className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C2185B] font-mono leading-relaxed ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Optional Job Description */}
              <div>
                <label htmlFor="ai-job-desc" className="block text-xs font-semibold mb-1">
                  Target Job Description <span className="opacity-65 font-normal">(Optional — helps match role keywords)</span>
                </label>
                <textarea
                  id="ai-job-desc"
                  rows={2}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value.slice(0, MAX_JOB_DESC_CHARS))}
                  placeholder="Optional: paste key requirements from a job posting you are targeting..."
                  className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C2185B] resize-y ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {status?.turnstileConfigured && status?.turnstileSiteKey && (
                <div ref={turnstileContainerRef} className="py-1" />
              )}

              {/* Explicit Privacy & AI Disclosure */}
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                  isDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-[11px] leading-relaxed opacity-85">
                  <strong>AI Processing &amp; Data-Use Disclosure:</strong> When public AI is active, your reviewed résumé text is sent securely through our server to Google Gemini solely to generate instant feedback and is not saved into Purpose &amp; Glow’s lead database or sold. AI suggestions do not invent qualifications or guarantee interviews or job placement.{' '}
                  {onOpenPrivacyPolicy && (
                    <button
                      type="button"
                      onClick={onOpenPrivacyPolicy}
                      className="underline font-semibold text-[#C2185B] dark:text-pink-300 cursor-pointer"
                    >
                      Read Privacy Policy
                    </button>
                  )}
                </p>

                <label htmlFor="ai-consent-check" className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    id="ai-consent-check"
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 rounded accent-[#C2185B]"
                  />
                  <span className="text-xs leading-snug">
                    <strong className="text-rose-500">*</strong> I have reviewed the text above, understand this is AI-generated career guidance with no employment guarantee, and consent to processing it for my assessment.
                  </span>
                </label>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Action Footer */}
              <div className="pt-2 border-t border-slate-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] opacity-75 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Personal contact info masked by default · Zero spam</span>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  {adminAuthToken && !staticMode && (
                    <button
                      type="button"
                      onClick={handleAdminPreviewTest}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl border border-teal-500/40 bg-teal-600/10 hover:bg-teal-600/20 text-teal-600 dark:text-teal-300 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Run Admin Preview Test</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || publicPaused}
                    title={
                      publicPaused
                        ? 'Public AI access is paused pre-launch (PUBLIC_AI_ENABLED=false)'
                        : 'Generate complimentary AI résumé assessment'
                    }
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#801040] text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Generating Feedback...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {publicPaused ? 'AI Assessment Paused Pre-Launch' : 'Get Instant AI Assessment'}
                        </span>
                        {!publicPaused && <ArrowRight className="w-3.5 h-3.5" />}
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
