import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User
} from 'lucide-react';
import type {
  InboundInquiry,
  InquiryStatus,
  InquiryType
} from '../lib/inquiryStore';
import { INQUIRY_STATUS_OPTIONS } from '../lib/inquiryStore';
import {
  BUSINESS_CONTACT_EMAIL,
  TALLY_REGISTRATION_URL,
  isStaticHostingMode,
  parseJsonApiResponse
} from '../lib/hostingMode';

interface InquiriesResponse {
  success: boolean;
  storageMode: 'firestore' | 'memory';
  emailConfigured: boolean;
  missingEmailConfig?: string[];
  count: number;
  totalCount: number;
  unreadCount: number;
  statusCounts: Record<InquiryStatus, number>;
  inquiries: InboundInquiry[];
}

interface InquiryManagementPanelProps {
  getFreshToken: () => Promise<string>;
  isDarkMode?: boolean;
  onUnreadCountChange?: (unreadCount: number) => void;
}

const STATUS_BADGE_CLASSES: Record<InquiryStatus, string> = {
  new: 'bg-pink-100 text-[#9C1450] border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800',
  contacted:
    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  in_progress:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  completed:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  closed:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
};

export function InquiryManagementPanel({
  getFreshToken,
  isDarkMode = false,
  onUnreadCountChange
}: InquiryManagementPanelProps) {
  const [inquiries, setInquiries] = useState<InboundInquiry[]>([]);
  const [storageMode, setStorageMode] = useState<'firestore' | 'memory'>('memory');
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [missingEmailConfig, setMissingEmailConfig] = useState<string[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<InquiryStatus, number>>({
    new: 0,
    contacted: 0,
    in_progress: 0,
    completed: 0,
    closed: 0
  });

  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | InquiryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const staticHosting = isStaticHostingMode();

  const fetchInquiries = useCallback(async () => {
    if (staticHosting) {
      setLoading(false);
      setBannerMsg(null);
      return;
    }
    setLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/contact/inquiries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = await parseJsonApiResponse<InquiriesResponse & { error?: string }>(res);
      if (!parsed.ok || !parsed.data) {
        throw new Error(
          parsed.isHtmlFallback
            ? 'Backend inquiry service is unavailable on static hosting.'
            : parsed.data?.error || `HTTP ${parsed.status}`
        );
      }
      const data = parsed.data;
      setInquiries(data.inquiries || []);
      setStorageMode(data.storageMode || 'memory');
      setEmailConfigured(Boolean(data.emailConfigured));
      setMissingEmailConfig(data.missingEmailConfig || []);
      if (data.statusCounts) setStatusCounts(data.statusCounts);
      if (onUnreadCountChange) onUnreadCountChange(data.unreadCount || 0);
      setSelectedId((curr) =>
        curr && data.inquiries.some((i) => i.id === curr)
          ? curr
          : data.inquiries[0]?.id || null
      );
    } catch (err: unknown) {
      setBannerMsg({
        text: err instanceof Error ? err.message : 'Unable to load inquiries.',
        isError: true
      });
    } finally {
      setLoading(false);
    }
  }, [getFreshToken, onUnreadCountChange, staticHosting]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const filteredInquiries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inquiries.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.inquiryType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.service.toLowerCase().includes(q) ||
        (item.targetRole || '').toLowerCase().includes(q) ||
        (item.currentRole || '').toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q)
      );
    });
  }, [inquiries, statusFilter, typeFilter, searchQuery]);

  const selectedInquiry = useMemo(() => {
    if (!filteredInquiries.length) return null;
    return filteredInquiries.find((i) => i.id === selectedId) || filteredInquiries[0];
  }, [filteredInquiries, selectedId]);

  useEffect(() => {
    setAdminNotesDraft(selectedInquiry?.adminNotes || '');
  }, [selectedInquiry?.id, selectedInquiry?.adminNotes]);

  const recalcCounts = (list: InboundInquiry[]) => {
    const counts: Record<InquiryStatus, number> = {
      new: 0,
      contacted: 0,
      in_progress: 0,
      completed: 0,
      closed: 0
    };
    for (const item of list) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    setStatusCounts(counts);
    if (onUnreadCountChange) {
      onUnreadCountChange(list.filter((i) => !i.isRead).length);
    }
  };

  const handleUpdateStatus = async (
    inquiryId: string,
    nextStatus: InquiryStatus,
    notes?: string
  ) => {
    setUpdatingId(inquiryId);
    setBannerMsg(null);
    try {
      const token = await getFreshToken();
      const res = await fetch(`/api/contact/inquiries/${encodeURIComponent(inquiryId)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: nextStatus,
          ...(notes !== undefined ? { adminNotes: notes } : {})
        })
      });
      const data = await res.json();
      if (!res.ok || !data.inquiry) {
        throw new Error(data.error || 'Failed to update inquiry status');
      }
      setInquiries((prev) => {
        const updatedList = prev.map((i) => (i.id === inquiryId ? data.inquiry : i));
        recalcCounts(updatedList);
        return updatedList;
      });
      setBannerMsg({ text: 'Inquiry status updated securely.' });
    } catch (err: unknown) {
      setBannerMsg({
        text: err instanceof Error ? err.message : 'Status update failed.',
        isError: true
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleRead = async (inquiry: InboundInquiry) => {
    setUpdatingId(inquiry.id);
    try {
      const token = await getFreshToken();
      const res = await fetch(`/api/contact/inquiries/${encodeURIComponent(inquiry.id)}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isRead: !inquiry.isRead })
      });
      const data = await res.json();
      if (res.ok && data.inquiry) {
        setInquiries((prev) => {
          const updatedList = prev.map((i) => (i.id === inquiry.id ? data.inquiry : i));
          recalcCounts(updatedList);
          return updatedList;
        });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRetryEmail = async (inquiryId: string) => {
    setRetryingId(inquiryId);
    setBannerMsg(null);
    try {
      const token = await getFreshToken();
      const res = await fetch(
        `/api/contact/inquiries/${encodeURIComponent(inquiryId)}/retry-notification`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await res.json();
      if (data.inquiry) {
        setInquiries((prev) => prev.map((i) => (i.id === inquiryId ? data.inquiry : i)));
      }
      if (data.success) {
        setBannerMsg({ text: 'Email notification dispatched via Resend.' });
      } else {
        setBannerMsg({
          text:
            data.result?.error ||
            'Email notification could not be sent yet. Inquiry remains safely stored.',
          isError: true
        });
      }
    } catch (err: unknown) {
      setBannerMsg({
        text: err instanceof Error ? err.message : 'Retry request failed.',
        isError: true
      });
    } finally {
      setRetryingId(null);
    }
  };

  const cardBg = isDarkMode
    ? 'bg-[#121622] border-[#22283A] text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const subCardBg = isDarkMode
    ? 'bg-[#181D2C] border-[#262E44] text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  return (
    <section className="space-y-5" aria-label="Inquiry Management">
      {/* Top Status & Readiness Card */}
      <div className={`rounded-xl border p-5 sm:p-6 space-y-4 ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C2185B] dark:text-pink-400">
              <Inbox className="w-4 h-4" />
              <span>Inquiry &amp; Complimentary Review Desk</span>
            </div>
            <h2 className="text-xl font-semibold">
              Contact Inquiries &amp; Complimentary Human Review Requests
            </h2>
            <p className="text-xs opacity-75">
              Saved first to persistent inquiry storage before attempting email dispatch, so applicant requests are never lost across server restarts or email outages. Full confidential résumés are never stored here.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchInquiries}
            disabled={loading || staticHosting}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isDarkMode
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{staticHosting ? 'Express API Paused' : 'Refresh Inquiries'}</span>
          </button>
        </div>

        {staticHosting ? (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${subCardBg}`}
            role="status"
          >
            <div className="font-semibold flex items-center gap-2 text-teal-800 dark:text-teal-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Static Hosting Mode Active (Free Firebase Hosting Spark Plan)</span>
            </div>
            <p className="leading-relaxed opacity-85">
              Because this static launch runs without the paid Express API backend, the server-side Inquiry API and Resend email dispatch are paused. Visitors submitting inquiries or Complimentary Human Reviews are routed directly to your Tally form and direct email ({BUSINESS_CONTACT_EMAIL}). All previously stored Firestore records remain intact.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={TALLY_REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white font-semibold"
              >
                Open Tally Submissions Form
              </a>
              <a
                href={`mailto:${BUSINESS_CONTACT_EMAIL}`}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold hover:underline"
              >
                {BUSINESS_CONTACT_EMAIL}
              </a>
            </div>
          </div>
        ) : (
          /* Honest Storage + Resend Readiness Pills */
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                storageMode === 'firestore'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                Storage:{' '}
                {storageMode === 'firestore'
                  ? 'Firestore /inquiries (Persistent)'
                  : 'Local Dev Memory (Firestore ADC/Credentials active in Cloud Run)'}
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                emailConfigured
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>
                Email Notifications:{' '}
                {emailConfigured
                  ? 'Resend Configured -> purposeandglowcareers@gmail.com'
                  : `Not Yet Configured (${missingEmailConfig.join('; ') || 'RESEND_API_KEY & verified RESEND_FROM_EMAIL needed'})`}
              </span>
            </span>
          </div>
        )}

        {bannerMsg && (
          <div
            role="status"
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              bannerMsg.isError
                ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
            }`}
          >
            {bannerMsg.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className={`rounded-xl border p-4 space-y-3 ${cardBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status filter buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#C2185B] text-white border-[#C2185B]'
                  : isDarkMode
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              All ({inquiries.length})
            </button>
            {INQUIRY_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-[#C2185B] text-white border-[#C2185B]'
                    : isDarkMode
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {opt.label} ({statusCounts[opt.value] || 0})
              </button>
            ))}
          </div>

          {/* Type + Search */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select
              aria-label="Filter by inquiry type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | InquiryType)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                isDarkMode
                  ? 'bg-[#181D2C] border-slate-700 text-slate-200'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              <option value="all">All Submission Types</option>
              <option value="contact_form">Contact Inquiries</option>
              <option value="complimentary_human_review">Complimentary Human Reviews</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, role, service..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-[#C2185B] ${
                  isDarkMode
                    ? 'bg-[#181D2C] border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left List */}
        <div className={`lg:col-span-5 rounded-xl border overflow-hidden ${cardBg}`}>
          {loading ? (
            <div className="p-8 text-center text-xs opacity-70">Loading inquiries...</div>
          ) : filteredInquiries.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Inbox className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-medium">No inquiries match this view</p>
              <p className="text-xs opacity-70">
                Website consultation requests and complimentary human review submissions will appear here once submitted.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[650px] overflow-y-auto">
              {filteredInquiries.map((inq) => {
                const isSelected = selectedInquiry?.id === inq.id;
                return (
                  <button
                    key={inq.id}
                    type="button"
                    onClick={() => setSelectedId(inq.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-[#1C2336]'
                          : 'bg-[#FFF5F8]'
                        : isDarkMode
                        ? 'hover:bg-[#171C2B]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!inq.isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-[#C2185B] shrink-0"
                            title="Unread"
                          />
                        )}
                        <span className="font-semibold text-sm truncate">{inq.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                          STATUS_BADGE_CLASSES[inq.status]
                        }`}
                      >
                        {INQUIRY_STATUS_OPTIONS.find((s) => s.value === inq.status)?.label ||
                          inq.status}
                      </span>
                    </div>

                    <div className="text-xs opacity-75 truncate">{inq.email}</div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${
                          inq.inquiryType === 'complimentary_human_review'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {inq.inquiryType === 'complimentary_human_review'
                          ? 'Complimentary Human Review'
                          : 'Contact Form'}
                      </span>
                      <span className="truncate max-w-[200px] opacity-80">{inq.service}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] opacity-60 pt-0.5">
                      <span>{new Date(inq.timestamp).toLocaleString()}</span>
                      <span>
                        Email:{' '}
                        {inq.notificationStatus === 'sent'
                          ? 'Sent'
                          : inq.notificationStatus === 'failed'
                          ? 'Failed'
                          : inq.notificationStatus === 'not_configured'
                          ? 'Pending Setup'
                          : 'Pending'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail & Actions Panel */}
        <div className={`lg:col-span-7 rounded-xl border p-5 sm:p-6 ${cardBg}`}>
          {!selectedInquiry ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center space-y-2 opacity-60">
              <MessageSquare className="w-8 h-8" />
              <p className="text-sm font-medium">Select an inquiry to inspect details and update status</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        selectedInquiry.inquiryType === 'complimentary_human_review'
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                          : 'bg-pink-100 text-[#9C1450] dark:bg-pink-950/60 dark:text-pink-300'
                      }`}
                    >
                      {selectedInquiry.inquiryType === 'complimentary_human_review'
                        ? 'Complimentary Human Review'
                        : 'Website Contact Form'}
                    </span>
                    <span className="text-xs opacity-60 font-mono">ID: {selectedInquiry.id}</span>
                  </div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <User className="w-4 h-4 text-[#C2185B]" />
                    <span>{selectedInquiry.name}</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs opacity-80">
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                        `Purpose & Glow Response: ${selectedInquiry.service}`
                      )}`}
                      className="inline-flex items-center gap-1 text-[#C2185B] dark:text-pink-400 hover:underline font-medium"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{selectedInquiry.email}</span>
                    </a>
                    {selectedInquiry.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{selectedInquiry.phone}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Submitted {new Date(selectedInquiry.timestamp).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleRead(selectedInquiry)}
                  disabled={updatingId === selectedInquiry.id}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedInquiry.isRead ? 'Mark Unread' : 'Mark Read'}
                </button>
              </div>

              {/* Metadata Grid */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border text-xs ${subCardBg}`}>
                <div>
                  <span className="opacity-60 block">Service Requested</span>
                  <span className="font-semibold">{selectedInquiry.service}</span>
                </div>
                <div>
                  <span className="opacity-60 block">Urgency / Priority</span>
                  <span className="font-semibold">
                    {selectedInquiry.urgency === 'urgent_48h'
                      ? 'Urgent (24–48h)'
                      : selectedInquiry.urgency === 'flexible'
                      ? 'Flexible'
                      : 'Standard (3–5 Days)'}
                  </span>
                </div>
                {selectedInquiry.currentRole && (
                  <div>
                    <span className="opacity-60 block">Current Role</span>
                    <span className="font-medium">{selectedInquiry.currentRole}</span>
                  </div>
                )}
                {selectedInquiry.targetRole && (
                  <div>
                    <span className="opacity-60 block">Target Direction</span>
                    <span className="font-medium">{selectedInquiry.targetRole}</span>
                  </div>
                )}
                {selectedInquiry.locationState && (
                  <div>
                    <span className="opacity-60 block">Location</span>
                    <span className="font-medium">{selectedInquiry.locationState}</span>
                  </div>
                )}
                {selectedInquiry.preferredIndustry && (
                  <div>
                    <span className="opacity-60 block">Preferred Industry</span>
                    <span className="font-medium">{selectedInquiry.preferredIndustry}</span>
                  </div>
                )}
              </div>

              {/* Submitted Message / Goals */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Applicant Notes &amp; Goals
                </span>
                <div className={`p-4 rounded-xl border text-xs leading-relaxed whitespace-pre-line ${subCardBg}`}>
                  {selectedInquiry.message}
                </div>
                {selectedInquiry.resumeIntakeNote && (
                  <p className="text-[11px] opacity-70 flex items-center gap-1.5 pt-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#C2185B] shrink-0" />
                    <span>{selectedInquiry.resumeIntakeNote}</span>
                  </p>
                )}
              </div>

              {/* Email Notification Delivery Status & Retry */}
              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${subCardBg}`}>
                <div className="space-y-0.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#C2185B]" />
                    <span>
                      Email Notification Status:{' '}
                      {selectedInquiry.notificationStatus === 'sent'
                        ? 'Sent'
                        : selectedInquiry.notificationStatus === 'failed'
                        ? 'Failed'
                        : selectedInquiry.notificationStatus === 'not_configured'
                        ? 'Not Configured'
                        : 'Pending'}
                    </span>
                    <span className="opacity-60 font-normal">
                      ({selectedInquiry.notificationAttempts || 0} attempt
                      {(selectedInquiry.notificationAttempts || 0) === 1 ? '' : 's'})
                    </span>
                  </div>
                  {selectedInquiry.notificationError && (
                    <p className="text-[11px] opacity-75">{selectedInquiry.notificationError}</p>
                  )}
                  {selectedInquiry.notificationId && (
                    <p className="text-[11px] font-mono opacity-70">
                      Message ID: {selectedInquiry.notificationId}
                    </p>
                  )}
                </div>

                {selectedInquiry.notificationStatus !== 'sent' && (
                  <button
                    type="button"
                    onClick={() => handleRetryEmail(selectedInquiry.id)}
                    disabled={retryingId === selectedInquiry.id}
                    className="px-3 py-1.5 rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {retryingId === selectedInquiry.id
                        ? 'Retrying...'
                        : 'Retry Email Notification'}
                    </span>
                  </button>
                )}
              </div>

              {/* Workflow Status Update & Notes */}
              <div className={`p-4 rounded-xl border space-y-3 ${subCardBg}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label
                      htmlFor="inquiry-status-select"
                      className="text-xs font-semibold block"
                    >
                      Workflow Status
                    </label>
                    <span className="text-[11px] opacity-70">
                      Update status cleanly as you follow up with this candidate.
                    </span>
                  </div>

                  <select
                    id="inquiry-status-select"
                    value={selectedInquiry.status}
                    disabled={updatingId === selectedInquiry.id}
                    onChange={(e) =>
                      handleUpdateStatus(
                        selectedInquiry.id,
                        e.target.value as InquiryStatus,
                        adminNotesDraft
                      )
                    }
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border outline-none focus:ring-2 focus:ring-[#C2185B] ${
                      isDarkMode
                        ? 'bg-[#121622] border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {INQUIRY_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="inquiry-admin-notes"
                    className="text-xs font-semibold block opacity-80"
                  >
                    Internal Follow-Up Notes
                  </label>
                  <textarea
                    id="inquiry-admin-notes"
                    rows={2}
                    value={adminNotesDraft}
                    onChange={(e) => setAdminNotesDraft(e.target.value)}
                    placeholder="Optional private follow-up notes (e.g. Sent Tally intake link on Tuesday)..."
                    className={`w-full px-3 py-2 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-[#C2185B] resize-none ${
                      isDarkMode
                        ? 'bg-[#121622] border-slate-700 text-white placeholder-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={updatingId === selectedInquiry.id}
                      onClick={() =>
                        handleUpdateStatus(
                          selectedInquiry.id,
                          selectedInquiry.status,
                          adminNotesDraft
                        )
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {updatingId === selectedInquiry.id ? 'Saving...' : 'Save Status & Notes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
