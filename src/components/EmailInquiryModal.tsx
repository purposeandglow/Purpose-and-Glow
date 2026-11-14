import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  X,
  Check,
  Send,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  User,
  Briefcase,
  ExternalLink,
  Copy
} from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import {
  BUSINESS_CONTACT_EMAIL,
  TALLY_REGISTRATION_URL,
  isStaticHostingMode,
  parseJsonApiResponse
} from '../lib/hostingMode';
import { safeCopyToClipboard } from '../utils/clipboard';

export interface EmailInquiryData {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  service: string;
  currentRole?: string;
  targetRole?: string;
  urgency: 'urgent_48h' | 'standard_week' | 'flexible';
  message: string;
  recipientEmail?: string;
}

interface EmailInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (inquiry: EmailInquiryData) => void;
  onOpenPrivacyPolicy?: () => void;
  defaultService?: string;
  recipientEmail?: string;
  isDarkMode?: boolean;
}

const SERVICE_OPTIONS = [
  { id: 'revamp_99', label: 'Professional Résumé Revamp — $99' },
  { id: 'scratch_145', label: 'Created From Scratch — $145' },
  { id: 'student_50', label: 'Student & Early Career Résumé — $50' },
  { id: 'cover_49', label: 'Targeted Cover Letter — $49' },
  { id: 'tailor_45', label: 'Job-Specific Résumé Tailoring — $45' },
  { id: 'interview_65', label: 'Interview Preparation Session — $65' },
  { id: 'career_ready_189', label: 'Career Ready Package — $189' },
  { id: 'fresh_start_239', label: 'Fresh Start Package — $239' },
  { id: 'strategy_free', label: 'Complimentary 15-Minute Strategy Call ($0)' },
  { id: 'diy_free', label: 'Free DIY Résumé Recommendations ($0)' }
];

export function EmailInquiryModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  onOpenPrivacyPolicy,
  defaultService = 'Professional Résumé Revamp — $99',
  recipientEmail = BUSINESS_CONTACT_EMAIL,
  isDarkMode = false
}: EmailInquiryModalProps) {
  const staticMode = isStaticHostingMode();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(defaultService);
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [urgency, setUrgency] = useState<'urgent_48h' | 'standard_week' | 'flexible'>('urgent_48h');
  const [message, setMessage] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [staticHandoffReady, setStaticHandoffReady] = useState(false);
  const [submittedData, setSubmittedData] = useState<EmailInquiryData | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    if (defaultService) {
      setService(defaultService);
    }
  }, [defaultService, isOpen]);

  const resetAndClose = useCallback(() => {
    setIsSubmitted(false);
    setStaticHandoffReady(false);
    setName('');
    setEmail('');
    setPhone('');
    setCurrentRole('');
    setTargetRole('');
    setMessage('');
    setConsentChecked(false);
    setErrorMessage(null);
    setCopiedSummary(false);
    onClose();
  }, [onClose]);

  const dialogRef = useDialogAccessibility(isOpen, resetAndClose, !isSubmitting);

  if (!isOpen) return null;

  const urgencyLabel =
    urgency === 'urgent_48h'
      ? 'Need within 24–48 hours'
      : urgency === 'standard_week'
      ? 'Within 3–5 days'
      : 'Flexible';

  const mailtoSubject = encodeURIComponent(
    `Purpose & Glow Consultation: ${service} - ${name || 'Job Seeker'}`
  );
  const plainSummaryText = `Hello Purpose & Glow Career Solutions,\n\nI am contacting you regarding ${service}.\n\nCurrent Role: ${currentRole || 'Not specified'}\nTarget Goal: ${targetRole || 'Not specified'}\nUrgency: ${urgencyLabel}\n\nNotes / Questions:\n${message}\n\nBest regards,\n${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}`;
  const mailtoBody = encodeURIComponent(plainSummaryText);
  const directMailtoUrl = `mailto:${recipientEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address so we can respond.');
      return;
    }
    if (!message.trim()) {
      setErrorMessage('Please share a few sentences about your career situation or goals.');
      return;
    }
    if (!consentChecked) {
      setErrorMessage('Please confirm the privacy consent checkbox before continuing.');
      return;
    }

    setErrorMessage(null);

    const payload: EmailInquiryData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      service,
      currentRole: currentRole.trim() || undefined,
      targetRole: targetRole.trim() || undefined,
      urgency,
      message: message.trim(),
      recipientEmail
    };

    if (staticMode) {
      const prepared: EmailInquiryData = {
        ...payload,
        id: `handoff-${Date.now()}`
      };
      setSubmittedData(prepared);
      setStaticHandoffReady(true);
      onSubmitSuccess(prepared);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const parsed = await parseJsonApiResponse<{ error?: string; id?: string; inquiry?: { id?: string } }>(res);
      if (!parsed.ok || !parsed.data) {
        setErrorMessage(
          parsed.isHtmlFallback
            ? 'Direct web-form saving is unavailable right now. Please complete your request using our Tally intake form or email app below.'
            : parsed.data?.error || 'Could not submit inquiry. Please review your details.'
        );
        return;
      }

      const completedInquiry: EmailInquiryData = {
        ...payload,
        id: parsed.data.inquiry?.id || parsed.data.id || `inq-${Date.now()}`
      };

      setSubmittedData(completedInquiry);
      setIsSubmitted(true);
      onSubmitSuccess(completedInquiry);
    } catch {
      setErrorMessage(
        'Unable to reach the server right now. Please complete your request via Tally or your email app below.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPreparedSummary = async () => {
    const ok = await safeCopyToClipboard(plainSummaryText);
    if (ok) {
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={resetAndClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative w-full max-w-xl my-auto rounded-2xl shadow-2xl border transition-colors outline-none ${
          isDarkMode
            ? 'bg-[#151720] border-[#2A2E3D] text-[#ECEFF4]'
            : 'bg-white border-slate-200 text-[#2D2D2D]'
        } overflow-hidden max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Top Header Banner */}
        <div
          className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between shrink-0 ${
            isDarkMode
              ? 'bg-[#1C1F2B] border-[#2A2E3D]'
              : 'bg-[#FFF0F5] border-[#F0C6D6]'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-[#C2185B] text-white flex items-center justify-center shadow-xs shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="modal-title"
                className={`text-sm sm:text-base font-bold font-serif ${
                  isDarkMode ? 'text-white' : 'text-[#2D2D2D]'
                }`}
              >
                Send Direct Inquiry
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className={`text-[11px] sm:text-xs truncate max-w-[180px] sm:max-w-none ${isDarkMode ? 'text-pink-300' : 'text-[#C2185B] font-medium'}`}>
                  {recipientEmail}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={resetAndClose}
            className={`p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? 'text-slate-300 hover:text-white hover:bg-[#252A3A]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-pink-100/50'
            }`}
            aria-label="Close direct inquiry modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {staticHandoffReady ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-700 mx-auto flex items-center justify-center text-[#C2185B] dark:text-pink-300">
                <ExternalLink className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className={`text-xl font-bold font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Complete Your Inquiry via Tally or Email
                </h3>
                <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} max-w-md mx-auto leading-relaxed`}>
                  Because this site is hosted statically, your details have <strong>not</strong> been transmitted yet. Choose <strong>Submit via Free Tally Form</strong> or <strong>Send via Your Email App</strong> below to complete your request.
                </p>
              </div>

              {submittedData && (
                <div
                  className={`p-4 rounded-xl text-left text-xs space-y-2 border ${
                    isDarkMode ? 'bg-[#1C1F2B] border-[#2A2E3D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="opacity-70">Name:</span>
                    <span className="font-semibold">{submittedData.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="opacity-70">Service:</span>
                    <span className="font-semibold text-[#C2185B] dark:text-pink-300">{submittedData.service}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="opacity-70">Timeline:</span>
                    <span>{urgencyLabel}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5">
                <a
                  href={TALLY_REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Continue to Free Tally Form</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={directMailtoUrl}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    isDarkMode
                      ? 'border-slate-600 text-slate-200 hover:bg-[#252A3A]'
                      : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Open Pre-Filled Email App</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyPreparedSummary}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isDarkMode
                      ? 'border-slate-700 text-slate-300 hover:bg-[#252A3A]'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSummary ? 'Notes Copied' : 'Copy Notes for Tally'}</span>
                </button>
              </div>
            </div>
          ) : isSubmitted ? (
            /* Backend-Confirmed Success State */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                <Check className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className={`text-xl font-bold font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Inquiry Received!
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} max-w-md mx-auto`}>
                  Your inquiry has been saved for Purpose &amp; Glow Career Solutions (<strong className="text-[#C2185B] dark:text-pink-300">{recipientEmail}</strong>). You can also send a copy directly via your email app below.
                </p>
              </div>

              {submittedData && (
                <div
                  className={`p-4 rounded-xl text-left text-xs space-y-2 border ${
                    isDarkMode ? 'bg-[#1C1F2B] border-[#2A2E3D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="opacity-70">Sender:</span>
                    <span className="font-semibold">{submittedData.name} ({submittedData.email})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Service:</span>
                    <span className="font-semibold text-[#C2185B] dark:text-pink-300">{submittedData.service}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Turnaround:</span>
                    <span>{urgencyLabel}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm"
                >
                  Back to Purpose &amp; Glow
                </button>
                <a
                  href={directMailtoUrl}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                    isDarkMode
                      ? 'border-slate-700 text-slate-300 hover:bg-[#252A3A]'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Open in Mail App</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            /* Interactive Form Fill */
            <form onSubmit={handleSubmit} className="space-y-4">
              {staticMode && (
                <div
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    isDarkMode
                      ? 'bg-[#1C1F2B] border-pink-500/30 text-slate-200'
                      : 'bg-[#FFF5F8] border-pink-200 text-slate-800'
                  }`}
                >
                  <strong>Direct Intake Mode:</strong> Prepare your inquiry summary below to continue directly to our secure{' '}
                  <a
                    href={TALLY_REGISTRATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold text-[#C2185B] dark:text-pink-300"
                  >
                    Tally Registration Form ↗
                  </a>{' '}
                  or pre-filled email app.
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Row 1: Name and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="inq-modal-name"
                    className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <User className="w-3.5 h-3.5 text-[#C2185B] dark:text-pink-400" />
                    <span>Your Full Name *</span>
                  </label>
                  <input
                    id="inq-modal-name"
                    type="text"
                    required
                    placeholder="e.g. Courtney Morales"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white placeholder-slate-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="inq-modal-email"
                    className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#C2185B] dark:text-pink-400" />
                    <span>Your Email Address *</span>
                  </label>
                  <input
                    id="inq-modal-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white placeholder-slate-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Row 2: Phone & Service selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="inq-modal-phone"
                    className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone Number (Optional)</span>
                  </label>
                  <input
                    id="inq-modal-phone"
                    type="tel"
                    placeholder="(612) 555-0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white placeholder-slate-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="inq-modal-service"
                    className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-[#C2185B] dark:text-pink-400" />
                    <span>Service Package</span>
                  </label>
                  <select
                    id="inq-modal-service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {SERVICE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Current Role & Target Goal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="inq-modal-current-role"
                    className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200"
                  >
                    Current Role / Field
                  </label>
                  <input
                    id="inq-modal-current-role"
                    type="text"
                    placeholder="e.g. Lead Medical Biller"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white placeholder-slate-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="inq-modal-target-role"
                    className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200"
                  >
                    Target Role / Destination
                  </label>
                  <input
                    id="inq-modal-target-role"
                    type="text"
                    placeholder="e.g. Clinic Operations Supervisor"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white placeholder-slate-400'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Urgency Selector Chips */}
              <fieldset>
                <legend className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#C2185B] dark:text-pink-400" />
                  <span>Turnaround Timeline</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'urgent_48h', label: 'Urgent (24–48h)', sub: 'Fast track' },
                    { id: 'standard_week', label: '3–5 Days', sub: 'Standard' },
                    { id: 'flexible', label: 'Flexible', sub: 'Exploring' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={urgency === chip.id}
                      onClick={() => setUrgency(chip.id as any)}
                      className={`p-2 rounded-lg text-center border transition-all cursor-pointer ${
                        urgency === chip.id
                          ? 'border-[#C2185B] bg-[#FFF0F5] dark:bg-[#C2185B]/25 text-[#9C1450] dark:text-pink-200 font-semibold ring-1 ring-[#C2185B]'
                          : isDarkMode
                          ? 'border-[#2A2E3D] bg-[#1C1F2B] text-slate-300 hover:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-medium">{chip.label}</div>
                      <div className="text-[10px] opacity-80">{chip.sub}</div>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Message Field */}
              <div>
                <label
                  htmlFor="inq-modal-message"
                  className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                >
                  <span>How can I help your career? *</span>
                  <span className="text-[11px] font-normal opacity-75">Briefly summarize your goals</span>
                </label>
                <textarea
                  id="inq-modal-message"
                  required
                  rows={3}
                  placeholder="e.g. I have 7 years in hospital denials and want my résumé to highlight measurable accomplishments..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#C2185B] resize-none ${
                    isDarkMode
                      ? 'bg-[#1C1F2B] border-[#2A2E3D] text-white placeholder-slate-400'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Privacy Consent */}
              <label htmlFor="inq-modal-consent" className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  id="inq-modal-consent"
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[#C2185B] shrink-0"
                />
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                  <strong className="text-rose-500">*</strong> I consent to Purpose &amp; Glow Career Solutions reviewing my submitted inquiry details solely to respond to my request.{' '}
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

              {/* Form Action Controls */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <a
                  href={directMailtoUrl}
                  className={`text-xs inline-flex items-center gap-1 transition-colors ${
                    isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Open standard mailto in your email app"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Or use external email app</span>
                </a>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting Inquiry...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{staticMode ? 'Prepare Tally / Email Handoff' : 'Submit Inquiry'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Info Strip */}
        <div
          className={`px-6 py-2.5 border-t text-[11px] flex flex-wrap items-center justify-between gap-2 ${
            isDarkMode
              ? 'bg-[#12141C] border-[#2A2E3D] text-slate-300'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#C2185B] dark:text-pink-400" />
            Purpose &amp; Glow Career Solutions · Minnesota | Remote Nationwide
          </span>
          <span className="font-mono text-[10px]">Replies within 1 business day</span>
        </div>
      </div>
    </div>
  );
}
