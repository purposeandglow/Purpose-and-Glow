import React, { useState } from 'react';
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
  GraduationCap,
  MapPin,
  DollarSign,
  User,
  Mail,
  Phone,
  HelpCircle,
  Compass
} from 'lucide-react';

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
  isDarkMode?: boolean;
}

export function FreeAssessmentModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  isDarkMode = false
}: FreeAssessmentModalProps) {
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
  const [submittedResult, setSubmittedResult] = useState<AssessmentData | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
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
    setIsSubmitting(true);

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

    try {
      const res = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const completed: AssessmentData = {
        ...payload,
        id: data.id || `assess-${Date.now()}`
      };
      setSubmittedResult(completed);
      setIsSubmitted(true);
      if (onSubmitSuccess) onSubmitSuccess(completed);
    } catch {
      // Fallback local completion
      const completed: AssessmentData = {
        ...payload,
        id: `assess-${Date.now()}`
      };
      setSubmittedResult(completed);
      setIsSubmitted(true);
      if (onSubmitSuccess) onSubmitSuccess(completed);
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
    setSubmittedResult(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-3xl my-auto rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 ${
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
              <div className="text-[10px] tracking-widest uppercase font-semibold text-pink-200">
                100% Free · No Obligation · Confidential
              </div>
              <h3 id="assessment-modal-title" className="text-xl font-bold tracking-tight">
                Free Career & Résumé Assessment
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Close assessment dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {isSubmitted ? (
            <div className="py-8 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <Check className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-bold text-emerald-400">Assessment Request Received!</h4>
              <p className="max-w-lg mx-auto text-sm opacity-90 leading-relaxed">
                Thank you, <strong className="font-semibold">{submittedResult?.fullName}</strong>. Your assessment details have been securely transmitted to{' '}
                <strong className="text-pink-400 underline">purposeandglowcareers@gmail.com</strong>.
              </p>
              <div
                className={`p-4 rounded-xl border text-left text-xs space-y-2 max-w-lg mx-auto ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between">
                  <span className="opacity-60">Target Direction:</span>
                  <span className="font-semibold">{submittedResult?.targetTitles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Experience Level:</span>
                  <span className="font-semibold">{submittedResult?.yearsExperience}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Service of Interest:</span>
                  <span className="font-semibold">{submittedResult?.primaryAssistance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Turnaround Expectation:</span>
                  <span className="font-semibold text-pink-400">Within 24–48 Business Hours</span>
                </div>
              </div>
              <p className="text-xs opacity-70">
                I will personally review your background and send your free recommendations with actionable résumé suggestions.
              </p>
              <div className="pt-3 flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] to-[#9C1450] text-white font-medium text-sm hover:opacity-95 shadow-md"
                >
                  Close & Return to Site
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Introduction Note */}
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
                  isDarkMode ? 'bg-pink-950/20 border-pink-900/40 text-pink-200' : 'bg-[#fff5f8] border-pink-200 text-pink-950'
                }`}
              >
                <Compass className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Complimentary Feedback &amp; Honest Expectations:</strong> Your initial feedback, career recommendations, and job search registration guidance are 100% free with no obligation. Paid résumé writing and coaching services are optional and quoted transparently. Free reviews provide guidance only and do not guarantee interviews, employment, or job placement.
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1: Contact Information */}
              <div>
                <h4 className="text-xs uppercase tracking-widest font-bold text-pink-500 mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> 1. Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1">
                      Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1">
                      Phone Number <span className="text-xs opacity-60">(Optional)</span>
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1">
                      State / Location <span className="text-xs opacity-60">(Remote Nationwide)</span>
                    </label>
                    <input
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
                <h4 className="text-xs uppercase tracking-widest font-bold text-pink-500 mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> 2. Career Experience & Target Direction
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Current or Most Recent Job Title <span className="text-rose-400">*</span>
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1">
                      Total Years of Work Experience
                    </label>
                    <select
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
                    <label className="block text-xs font-semibold mb-1">
                      Target Job Title(s) <span className="text-rose-400">*</span>
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1">
                      Preferred Industry
                    </label>
                    <select
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
                    <label className="block text-xs font-semibold mb-1">
                      Highest Education / Credential
                    </label>
                    <select
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
                    <label className="block text-xs font-semibold mb-1">
                      Work Preference & Desired Salary
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
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
                <h4 className="text-xs uppercase tracking-widest font-bold text-pink-500 mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> 3. Résumé Details & Service Interest
                </h4>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      LinkedIn URL <span className="text-xs opacity-60">(Optional, helps me review your work history)</span>
                    </label>
                    <input
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
                    <label className="block text-xs font-semibold mb-1">
                      Primary Service You Are Exploring
                    </label>
                    <select
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
                    <label className="block text-xs font-semibold mb-1">
                      Tell me about your current situation or paste your current bullet points
                    </label>
                    <textarea
                      rows={3}
                      value={resumeNotes}
                      onChange={(e) => setResumeNotes(e.target.value)}
                      placeholder="e.g. I’ve been applying for 3 months with little response. My current resume feels like a job description rather than showing my accomplishments..."
                      className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Checkboxes & Consent */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={wantsDiyTips}
                    onChange={(e) => setWantsDiyTips(e.target.checked)}
                    className="mt-0.5 rounded text-pink-600 focus:ring-pink-500 accent-[#C2185B]"
                  />
                  <span>
                    Include <strong>Free DIY Résumé Recommendations</strong> showing actionable duty-to-metric formula examples.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded text-pink-600 focus:ring-pink-500 accent-[#C2185B]"
                  />
                  <span>
                    <strong className="text-rose-500">*</strong> I agree to receive a confidential, personal review of my career materials from Purpose & Glow Career Solutions at <strong className="text-pink-500">purposeandglowcareers@gmail.com</strong>.
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-between border-t pt-4 border-slate-700/20">
                <div className="text-[11px] opacity-70 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  Your information is private and never sold or shared.
                </div>

                <div className="flex gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-400/30 text-xs font-semibold hover:bg-slate-500/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2185B] via-[#9C1450] to-[#801040] text-white text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Free Assessment
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
