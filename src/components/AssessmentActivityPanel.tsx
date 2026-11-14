import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import type { AssessmentActivitySnapshot } from '../lib/assessmentMetrics';
import type { StructuredResumeAssessment } from '../lib/assessmentConstants';
import { formatAssessmentForClipboard } from '../lib/assessmentFormatter';
import { safeCopyToClipboard } from '../utils/clipboard';
import { isStaticHostingMode, parseJsonApiResponse } from '../lib/hostingMode';

interface AdminMetricsResponse {
  success: boolean;
  publicAiEnabled: boolean;
  turnstileConfigured: boolean;
  turnstileSiteKeyConfigured: boolean;
  rateLimitStorageMode: 'distributed_firestore' | 'distributed_custom' | 'serialized_local_dev';
  limits: {
    hourlyIpLimit: number;
    dailyIpLimit: number;
    dailyGlobalLimit: number;
    monthlyGlobalLimit: number;
  };
  models: {
    publicModel: string;
    adminModel: string;
    hasApiKey: boolean;
  };
  metrics: AssessmentActivitySnapshot;
}

interface GeminiVerifyResponse {
  success: boolean;
  publicAiEnabled: boolean;
  verification: {
    configured: boolean;
    verifiedAt: string;
    configuredModels: {
      publicModel: string;
      adminModel: string;
    };
    availableModels: string[];
    publicModelAvailable: boolean;
    adminModelAvailable: boolean;
    fallbackTextCandidates: string[];
    error?: string;
  };
}

interface AssessmentActivityPanelProps {
  getFreshToken: () => Promise<string>;
  isDarkMode?: boolean;
}

const FICTIONAL_TEST_PROFILES = [
  {
    id: 'rcm_supervisor',
    label: 'Revenue Cycle Specialist -> Supervisor',
    targetJobTitle: 'Revenue Cycle Supervisor',
    industry: 'Healthcare / Clinical / Revenue Cycle',
    resumeText: `HEALTHCARE REVENUE CYCLE SPECIALIST | [REDACTED_LOCATION]
Summary: Revenue cycle professional with 7 years handling hospital denial appeals, insurance verification, and prior authorizations across outpatient clinic workflows.
Experience:
- Reviewed commercial and government payer claim denials daily and submitted appeal letters using Epic EHR.
- Coordinated with clinic front desk staff regarding patient eligibility and prior authorization statuses.
- Assisted billing team with aging accounts receivable follow-up and documentation tracking.
Skills: Epic Resolute, ICD-10, CPT, Claim Appeals, Prior Authorization, Payer Portals, Microsoft Excel.`
  },
  {
    id: 'entry_level',
    label: 'Entry-Level Applicant (Limited Experience)',
    targetJobTitle: 'Patient Access Coordinator',
    industry: 'Healthcare / Clinical / Revenue Cycle',
    resumeText: `HEALTHCARE ADMINISTRATION GRADUATE | [REDACTED_LOCATION]
Education: B.S. in Healthcare Administration, May 2026. Coursework in medical terminology, health policy, and Electronic Health Records fundamentals.
Experience:
- Summer Administrative Intern, Community Health Clinic (June 2025 – August 2025): Shadowed patient scheduling staff, organized intake packets, and assisted with scanning patient consent forms.
- Shift Barista, Campus Coffee Co. (2023 – Present): Prepared customer orders during peak morning hours, trained two new seasonal hires on register routines, and reconciled end-of-day cash drawer.
Skills: Microsoft Office, Patient Scheduling Support, Medical Terminology, Customer Service.`
  },
  {
    id: 'career_changer',
    label: 'Career Changer (K-12 -> Healthcare Onboarding)',
    targetJobTitle: 'Healthcare Onboarding & Training Specialist',
    industry: 'Career Pivot / Multiple Industries',
    resumeText: `K-12 EDUCATOR & GRADE-LEVEL CURRICULUM COORDINATOR | [REDACTED_LOCATION]
Summary: High school educator with 8 years designing lesson plans, facilitating classroom training for diverse learners, and coordinating parent-teacher communication.
Experience:
- Classroom Teacher, Oakview Public Schools (2018 – Present): Delivered daily instruction for classes of 25–30 students, adapted written training guides for different learning paces, and maintained attendance and assessment logs.
- Grade-Level Coordinator (2021 – Present): Coordinated weekly curriculum pacing meetings with 5 fellow teachers and compiled shared onboarding checklists for substitute educators.
Skills: Workshop Facilitation, Written Training Guides, Cross-Team Coordination, Google Workspace, LMS Administration.`
  },
  {
    id: 'executive_director',
    label: 'Experienced Director / Executive',
    targetJobTitle: 'Vice President of Ambulatory Operations',
    industry: 'Operations & Practice Management',
    resumeText: `DIRECTOR OF OUTPATIENT CLINIC OPERATIONS | [REDACTED_LOCATION]
Summary: Healthcare operations director with 14 years overseeing multi-site ambulatory clinic workflows, staffing coordination, and payer compliance processes across regional specialty practices.
Experience:
- Director of Outpatient Operations, Midwest Specialty Clinics (2019 – Present): Directed daily non-clinical operations across 4 outpatient sites totaling 45 front-desk and billing staff, partnered with physician leads on clinic scheduling templates, and standardized patient intake documentation procedures.
- Clinic Operations Manager, Lakeshore Health Group (2014 – 2019): Managed 16 administrative specialists, led quarterly payer audit readiness reviews, and supported EHR template transitions.
Skills: Multi-Site Ambulatory Operations, Staff Supervision, Clinic Scheduling Workflows, Compliance Readiness, Epic Practice Management.`
  }
] as const;

export function AssessmentActivityPanel({
  getFreshToken,
  isDarkMode = false
}: AssessmentActivityPanelProps) {
  const [data, setData] = useState<AdminMetricsResponse | null>(null);
  const [geminiCheck, setGeminiCheck] = useState<GeminiVerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingModels, setVerifyingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProfileId, setSelectedProfileId] = useState<string>(FICTIONAL_TEST_PROFILES[0].id);
  const [isTestingPipeline, setIsTestingPipeline] = useState(false);
  const [previewResult, setPreviewResult] = useState<StructuredResumeAssessment | null>(null);
  const [previewProfileLabel, setPreviewProfileLabel] = useState<string>(FICTIONAL_TEST_PROFILES[0].targetJobTitle);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const staticHosting = isStaticHostingMode();

  const fetchMetrics = useCallback(async () => {
    if (staticHosting) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/admin/assessments/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await parseJsonApiResponse<AdminMetricsResponse & { error?: string }>(res);
      if (!parsed.ok || !parsed.data) {
        throw new Error(
          parsed.isHtmlFallback
            ? 'Assessment metrics require the Express backend server.'
            : parsed.data?.error || `HTTP ${parsed.status}`
        );
      }
      setData(parsed.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assessment telemetry');
    } finally {
      setLoading(false);
    }
  }, [getFreshToken, staticHosting]);

  const handleVerifyGeminiModels = async () => {
    if (staticHosting) {
      setError('Live Gemini model verification requires the Express backend server.');
      return;
    }
    setVerifyingModels(true);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/admin/system/gemini-models', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await parseJsonApiResponse<GeminiVerifyResponse & { error?: string }>(res);
      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.data?.error || 'Gemini verification unavailable in static hosting mode');
      }
      setGeminiCheck(parsed.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gemini verification failed');
    } finally {
      setVerifyingModels(false);
    }
  };

  const handleRunAdminPreviewTest = async () => {
    if (staticHosting) {
      setPreviewError('Admin AI preview test requires the Express backend server.');
      return;
    }
    const profile =
      FICTIONAL_TEST_PROFILES.find((p) => p.id === selectedProfileId) || FICTIONAL_TEST_PROFILES[0];
    setIsTestingPipeline(true);
    setPreviewError(null);
    setPreviewResult(null);
    setPreviewProfileLabel(profile.targetJobTitle);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/admin/assessments/preview-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetJobTitle: profile.targetJobTitle,
          industry: profile.industry,
          resumeText: profile.resumeText
        })
      });
      const parsed = await parseJsonApiResponse<{ assessment?: StructuredResumeAssessment; error?: string }>(res);
      if (!parsed.ok || !parsed.data?.assessment) {
        throw new Error(parsed.data?.error || 'Admin preview test failed');
      }
      setPreviewResult(parsed.data.assessment);
      setCopiedPreview(false);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to run preview test');
    } finally {
      setIsTestingPipeline(false);
    }
  };

  const handleCopySampleOutput = async () => {
    if (!previewResult) return;
    const text = formatAssessmentForClipboard(previewResult, previewProfileLabel);
    const ok = await safeCopyToClipboard(text);
    if (ok) {
      setCopiedPreview(true);
      window.setTimeout(() => setCopiedPreview(false), 3000);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const cardBg = isDarkMode
    ? 'bg-[#121622] border-[#22283A] text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const subCardBg = isDarkMode
    ? 'bg-[#181D2C] border-[#262E44] text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  return (
    <section className="space-y-6">
      {/* Header Row */}
      <div className={`rounded-xl border p-6 space-y-4 ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              <Activity className="w-4 h-4" />
              <span>Phase 3 · Aggregate Telemetry &amp; Pre-Launch Readiness</span>
            </div>
            <h2 className="text-xl font-semibold">Public AI Résumé Assessment Monitor</h2>
            <p className="text-xs opacity-75">
              Tracks aggregate system safety, rate limits, Tally clicks, and paid-service interest only. Visitor names, emails, IPs, and résumé contents are never stored or logged.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleVerifyGeminiModels}
              disabled={verifyingModels || staticHosting}
              className="px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border-teal-600/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 disabled:opacity-50"
            >
              <Cpu className={`w-3.5 h-3.5 ${verifyingModels ? 'animate-spin' : ''}`} />
              <span>
                {staticHosting
                  ? 'Express API Required'
                  : verifyingModels
                  ? 'Checking Models...'
                  : 'Verify Live Gemini Models'}
              </span>
            </button>

            <button
              type="button"
              onClick={fetchMetrics}
              disabled={loading || staticHosting}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {staticHosting && (
          <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${subCardBg}`} role="status">
            <div className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Lock className="w-4 h-4 shrink-0" />
              <span>PUBLIC_AI_ENABLED = false (Static Hosting Mode Active)</span>
            </div>
            <p className="leading-relaxed opacity-85">
              Public AI résumé scoring is disabled for free static hosting. Visitors clicking Free Résumé Review are routed to your Complimentary Human Review workflow and Tally form. Live telemetry, Gemini model checks, and Admin preview runs activate automatically when the Express backend is deployed.
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
            {error}
          </div>
        )}

        {/* Security & Launch Readiness Flags */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className={`p-3.5 rounded-xl border space-y-1 ${subCardBg}`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Public AI Gate</span>
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-sm font-mono font-bold">
                {data.publicAiEnabled ? 'ENABLED (LIVE)' : 'PAUSED (false)'}
              </div>
              <p className="text-[11px] opacity-75">
                Public POST requests return HTTP 503 while disabled.
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border space-y-1 ${subCardBg}`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Rate-Limit Storage</span>
                {data.rateLimitStorageMode === 'distributed_firestore' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
              <div className="text-sm font-mono font-bold">
                {data.rateLimitStorageMode === 'distributed_firestore'
                  ? 'Firestore Distributed'
                  : 'Local Serialized Dev'}
              </div>
              <p className="text-[11px] opacity-75">
                Caps: {data.limits.hourlyIpLimit}/hr &amp; {data.limits.dailyIpLimit}/day per IP · {data.limits.dailyGlobalLimit}/day &amp; {data.limits.monthlyGlobalLimit}/mo global.
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border space-y-1 ${subCardBg}`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Cloudflare Turnstile</span>
                <ShieldCheck
                  className={`w-3.5 h-3.5 ${
                    data.turnstileConfigured ? 'text-emerald-500' : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="text-sm font-mono font-bold">
                {data.turnstileConfigured ? 'Configured & Enforced' : 'Pending Production Keys'}
              </div>
              <p className="text-[11px] opacity-75">
                Requires TURNSTILE_SITE_KEY &amp; TURNSTILE_SECRET_KEY before public launch.
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border space-y-1 ${subCardBg}`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Configured Models</span>
                <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              </div>
              <div className="text-xs font-mono font-bold truncate" title={data.models.publicModel}>
                Public: {data.models.publicModel}
              </div>
              <p className="text-[11px] opacity-75">
                Server API key detected: {data.models.hasApiKey ? 'Yes' : 'No (fallback mode)'}
              </p>
            </div>
          </div>
        )}

        {/* Live Gemini Model List Verification Result */}
        {geminiCheck && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 ${subCardBg}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-semibold">
                Live Gemini API Verification ({new Date(geminiCheck.verification.verifiedAt).toLocaleTimeString()})
              </strong>
              <span className="font-mono">
                Public Model Ready:{' '}
                {geminiCheck.verification.publicModelAvailable ? 'YES' : 'CHECK LIST'}
              </span>
            </div>
            {geminiCheck.verification.error ? (
              <p className="text-rose-500">{geminiCheck.verification.error}</p>
            ) : (
              <p className="opacity-80">
                Fallback / available text candidates ({geminiCheck.verification.fallbackTextCandidates.length}):{' '}
                <span className="font-mono">
                  {geminiCheck.verification.fallbackTextCandidates.slice(0, 8).join(', ') || 'None'}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Aggregate Counters */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Requested', value: data.metrics.requested },
            { label: 'Completed', value: data.metrics.completed },
            { label: 'Failed', value: data.metrics.failed },
            { label: 'Rate Limited', value: data.metrics.rateLimited },
            { label: 'Blocked (Paused)', value: data.metrics.blockedWhileDisabled },
            { label: 'Tally Clicks', value: data.metrics.tallyConversions },
            { label: 'Human Review Pref', value: data.metrics.humanReviewSelections }
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border p-4 ${cardBg}`}>
              <div className="text-[11px] opacity-70 font-medium">{stat.label}</div>
              <div className="text-2xl font-bold font-mono mt-1 tabular-nums">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Paid Service Exploration Counts & Pre-Launch Test Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-5 rounded-xl border p-5 space-y-3 ${cardBg}`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80">
            <Users className="w-4 h-4 text-[#C2185B]" />
            <span>Service Exploration Interest (Anonymous)</span>
          </div>
          {data && (
            <div className="space-y-2 text-xs">
              {[
                { key: 'student_50', label: 'Student Résumé ($50)' },
                { key: 'revamp_99', label: 'Résumé Revamp ($99)' },
                { key: 'scratch_145', label: 'Created From Scratch ($145)' },
                { key: 'tailoring_45', label: 'Job-Specific Tailoring ($45)' },
                { key: 'cover_letter_49', label: 'Targeted Cover Letter ($49)' },
                { key: 'interview_65', label: 'Interview Preparation ($65)' }
              ].map((row) => (
                <div
                  key={row.key}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${subCardBg}`}
                >
                  <span>{row.label}</span>
                  <span className="font-mono font-bold tabular-nums">
                    {data.metrics.serviceInterestCounts[
                      row.key as keyof AssessmentActivitySnapshot['serviceInterestCounts']
                    ] || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`lg:col-span-7 rounded-xl border p-5 space-y-4 ${cardBg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Admin Pre-Launch AI Pipeline Verification</h3>
              <p className="text-xs opacity-75">
                Tests grounded 8-section résumé feedback via your authenticated admin session while PUBLIC_AI_ENABLED remains false for the public.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                aria-label="Fictional Test Résumé Profile"
                className={`px-2.5 py-2 rounded-lg border text-xs font-medium ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {FICTIONAL_TEST_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRunAdminPreviewTest}
                disabled={isTestingPipeline || staticHosting}
                className="px-4 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
              >
                {staticHosting
                  ? 'Requires Express Backend'
                  : isTestingPipeline
                  ? 'Running Sample Test...'
                  : 'Run Grounded Sample Test'}
              </button>
            </div>
          </div>

          {previewError && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs">
              {previewError}
            </div>
          )}

          {previewResult && (
            <div className={`p-4 rounded-xl border space-y-3 text-xs ${subCardBg}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-500/20">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Sample Pipeline Verified (All 8 Structured Sections · {previewProfileLabel})
                </div>
                <button
                  type="button"
                  onClick={handleCopySampleOutput}
                  className="px-2.5 py-1 rounded-lg border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedPreview ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPreview ? 'Copied' : 'Copy Sample Output'}</span>
                </button>
              </div>

              {previewResult.factualWarnings && previewResult.factualWarnings.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="font-semibold">
                    Admin Factual Audit Log ({previewResult.factualWarnings.length} auto-adjusted before display — hidden from public applicants)
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {previewResult.factualWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-1">
                <div className="font-semibold uppercase text-[10px] opacity-75">
                  1. Overall Evaluation
                </div>
                <p className="leading-relaxed">{previewResult.overallEvaluation}</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-500/20 space-y-1.5">
                <div className="font-semibold uppercase text-[10px] opacity-75">
                  3. Ready-to-Adapt Professional Summary (Copy-Only Text)
                </div>
                <p className="font-medium leading-relaxed">
                  {previewResult.readyToAdaptSummary ||
                    (previewResult.professionalSummarySuggestions[0] || '')
                      .replace(/^Ready-to-Adapt\s+Summary:\s*/i, '')
                      .replace(/^["“']+|["”']+$/g, '')}
                </p>
                {(previewResult.summaryCoachingNote || previewResult.professionalSummarySuggestions.length > 1) && (
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    {previewResult.summaryCoachingNote ||
                      previewResult.professionalSummarySuggestions.slice(1).join(' ')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    title: '2. ATS Compatibility Recommendations',
                    items: previewResult.atsCompatibilityRecommendations
                  },
                  {
                    title: '4. Work Experience & Achievement Framing',
                    items: previewResult.workExperienceRecommendations
                  },
                  {
                    title: '5. Skills & Keyword Alignment',
                    items: previewResult.skillsAndKeywordRecommendations
                  },
                  {
                    title: '6. Formatting & Readability',
                    items: previewResult.formattingAndReadabilitySuggestions
                  },
                  {
                    title: '7. Practical Job-Search Next Steps',
                    items: previewResult.practicalJobSearchRecommendations
                  }
                ].map((sec) => (
                  <div key={sec.title} className="space-y-1">
                    <div className="font-semibold uppercase text-[10px] opacity-75">
                      {sec.title}
                    </div>
                    <ul className="list-disc pl-4 space-y-1 opacity-90 leading-relaxed">
                      {sec.items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {previewResult.beforeAfterExamples.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="font-semibold uppercase text-[10px] opacity-75">
                    8. Grounded Before &amp; After Bullet Examples
                  </div>
                  {previewResult.beforeAfterExamples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-500/20 space-y-1"
                    >
                      <div>
                        <span className="font-semibold opacity-70">From sample résumé:</span>{' '}
                        <span className="italic">{ex.originalContext}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Improved option:
                        </span>{' '}
                        <span>{ex.improvedExample}</span>
                      </div>
                      {ex.whyItWorks && (
                        <div className="opacity-75">Why it works: {ex.whyItWorks}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1 border-t border-slate-500/20 space-y-1">
                <div>
                  <span className="font-semibold">Suggested Service Focus:</span>{' '}
                  <span>{previewResult.suggestedServiceFocus}</span>
                </div>
                <p className="opacity-75 italic">{previewResult.disclaimer}</p>
              </div>
            </div>
          )}

          {/* Sanitized Recent Events */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider opacity-75">
              Recent Sanitized System Events (Zero PII)
            </h4>
            {!data || data.metrics.recentEvents.length === 0 ? (
              <p className="text-xs opacity-60 italic">No assessment activity recorded yet in this server session.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {data.metrics.recentEvents.slice(0, 15).map((evt) => (
                  <div
                    key={evt.id}
                    className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-3 ${subCardBg}`}
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-500/15 mr-2">
                        {evt.type}
                      </span>
                      <span className="truncate">{evt.detail}</span>
                    </div>
                    <span className="text-[11px] font-mono opacity-60 shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
