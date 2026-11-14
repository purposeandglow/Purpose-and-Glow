import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  INITIAL_KEYWORD_RULES,
  PURPOSE_GLOW_PACKAGES,
  KeywordRule,
  LeadSignal,
  ServicePackage,
  analyzeSignalText
} from '../data/purposeGlowData';
import { LiveQualifierPanel } from './LiveQualifierPanel';
import { KeywordRulesManager } from './KeywordRulesManager';
import { CadenceBoundaryPlanner } from './CadenceBoundaryPlanner';
import { safeCopyToClipboard } from '../utils/clipboard';
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  ArrowUpRight,
  FileText,
  RefreshCw,
  Plus,
  Radio,
  Sparkles,
  Database,
  Zap,
  Lock,
  Bell,
  Moon,
  Sun,
  X,
  Download,
  Upload,
  Cloud
} from 'lucide-react';
import { logOut } from '../lib/firebase.ts';
import {
  buildClientDataBackup,
  validateBackupBundle,
  restoreClientDataBackup,
  triggerBackupDownload,
  type ServerBackupSnapshot
} from '../lib/dataBackup.ts';
import {
  saveLeadToFirestore,
  fetchAdminLeadsFromFirestore,
  fetchAdminKeywordRulesFromFirestore,
  syncAdminRecordsToFirestore,
  mergeLocalAndCloudRecords
} from '../lib/firestoreStore.ts';
import type { User } from 'firebase/auth';
import { GeminiCopilotDrawer } from './GeminiCopilotDrawer.tsx';
import { AdminNotificationsPopover, AdminNotification } from './AdminNotificationsPopover';
import { AssessmentActivityPanel } from './AssessmentActivityPanel';
import { InquiryManagementPanel } from './InquiryManagementPanel';
import { isStaticHostingMode, parseJsonApiResponse } from '../lib/hostingMode';

type ActiveTab = 'feed' | 'qualifier' | 'keywords' | 'cadence' | 'assessments' | 'inquiries';
type FeedFilter =
  | 'qualified_buyers'
  | 'live_stream'
  | 'healthcare_niche'
  | 'in_conversation'
  | 'booked'
  | 'noise_filtered'
  | 'all';

export interface LinkedInLauncher {
  topic: string;
  label: string;
  query: string;
  url: string;
  icpId: string;
}

const LIVE_LINKEDIN_LAUNCHERS: LinkedInLauncher[] = [
  {
    topic: 'rcm',
    label: 'RCM & Denials',
    query: '"revenue cycle" OR "medical billing" OR "denials" "resume"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22revenue%20cycle%22%20OR%20%22medical%20billing%22%20OR%20%22denials%22%20%22resume%22&sortBy=%22date_posted%22',
    icpId: 'healthcare_rcm'
  },
  {
    topic: 'clinic_ops',
    label: 'Clinic Operations',
    query: '"clinic supervisor" OR "clinic operations" OR "patient access" "resume"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22clinic%20supervisor%22%20OR%20%22clinic%20operations%22%20OR%20%22patient%20access%22%20%22resume%22&sortBy=%22date_posted%22',
    icpId: 'healthcare_rcm'
  },
  {
    topic: 'transferable_skills',
    label: 'Transferable Skills',
    query: '"transferable skills" OR "haven\'t updated my resume" "looking for"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22transferable%20skills%22%20OR%20%22haven%27t%20updated%20my%20resume%22%20%22looking%20for%22&sortBy=%22date_posted%22',
    icpId: 'career_pivot'
  },
  {
    topic: 'career_pivot',
    label: '10+ Year Career Pivot',
    query: '"10 years" OR "15 years" "changing careers" OR "career pivot" "resume"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%2210%20years%22%20OR%20%2215%20years%22%20%22changing%20careers%22%20OR%20%22career%20pivot%22%20%22resume%22&sortBy=%22date_posted%22',
    icpId: 'career_pivot'
  },
  {
    topic: 'layoff_urgent',
    label: 'Recent Layoffs',
    query: '"laid off" AND ("resume review" OR "update my resume" OR "need a resume")',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22laid%20off%22%20AND%20(%22resume%20review%22%20OR%20%22update%20my%20resume%22%20OR%20%22need%20a%20resume%22)&sortBy=%22date_posted%22',
    icpId: 'layoff_urgent'
  },
  {
    topic: 'interview_friction',
    label: 'Interview Friction',
    query: '"not getting interviews" OR "no callbacks" "resume"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22not%20getting%20interviews%22%20OR%20%22no%20callbacks%22%20%22resume%22&sortBy=%22date_posted%22',
    icpId: 'healthcare_rcm'
  },
  {
    topic: 'student_grad',
    label: 'Early Healthcare Careerists',
    query: '"new grad" OR "entry level" "healthcare" "resume"',
    url: 'https://www.linkedin.com/search/results/content/?keywords=%22new%20grad%22%20OR%20%22entry%20level%22%20%22healthcare%22%20%22resume%22&sortBy=%22date_posted%22',
    icpId: 'student_grad'
  }
];

const ONE_CLICK_ICP_PRESETS = [
  {
    name: 'Courtney Morales, CPC',
    headline: 'Revenue Cycle Specialist & Certified Professional Coder',
    location: 'Minneapolis, MN',
    sourceUrl: 'https://www.linkedin.com/search/results/content/?keywords=%22revenue%20cycle%22%20OR%20%22medical%20billing%22%20OR%20%22denials%22%20%22resume%22',
    rawText: 'After 7 years handling complex hospital denial appeals in Epic and billing workflows, I am updating my résumé to target Patient Access & RCM Supervisor roles. But every recruiter feedback says my bullet points read like a job description rather than accomplishments. How do you quantify claim resolution and appeal turnaround without violating confidentiality?',
    cluster: 'healthcare_rcm' as const,
    badge: 'RCM & Denials ($99)'
  },
  {
    name: 'Danielle Vance',
    headline: 'Clinic Operations Supervisor',
    location: 'Robbinsdale, MN',
    sourceUrl: 'https://www.linkedin.com/search/results/content/?keywords=%22clinic%20supervisor%22%20OR%20%22clinic%20operations%22',
    rawText: '11 years managing multi-provider outpatient clinic operations, staffing 18 medical assistants, and overseeing empanelment workflows. I haven’t updated my résumé since 2014 and want to pivot to a Director of Healthcare Practice Management role. Does anyone have recommendations for professional résumé writers who understand clinical practice dynamics?',
    cluster: 'healthcare_rcm' as const,
    badge: '11-Yr Clinic Ops ($145)'
  },
  {
    name: 'Tasha Miller',
    headline: 'Prior Authorization & Patient Services Lead',
    location: 'Plymouth, MN',
    sourceUrl: 'https://www.linkedin.com/search/results/content/?keywords=%22laid%20off%22%20AND%20%22resume%20review%22',
    rawText: 'Unfortunately impacted by sudden clinic restructuring this morning alongside 15 teammates. Need to get my résumé completely overhauled in the next 24-48 hours so I can apply to open positions at Allina and HealthPartners before Monday. Looking for an experienced résumé writer who can turn around a polished revamp fast without sacrificing quality!',
    cluster: 'layoff_urgent' as const,
    badge: 'Urgent Layoff ($99)'
  },
  {
    name: 'Jasmine Chen',
    headline: 'Health Services Management Graduate',
    location: 'Minneapolis, MN',
    sourceUrl: 'https://www.linkedin.com/search/results/content/?keywords=%22new%20grad%22%20OR%20%22entry%20level%22%20%22healthcare%22',
    rawText: 'Graduated last month with a B.S. in Health Services Management and completed my clinic reception capstone. Every entry-level job posting asks for 2-3 years of experience and I feel like my résumé looks completely empty with just coursework. Looking for budget-friendly student résumé guidance ($50) to position my clinic reception experience properly.',
    cluster: 'student_grad' as const,
    badge: 'Early Grad ($50)'
  }
];

interface AdminWorkbenchProps {
  currentUser: User;
  authToken: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onExitToClient: () => void;
  notifications: AdminNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AdminNotification[]>>;
  leads: LeadSignal[];
  setLeads: React.Dispatch<React.SetStateAction<LeadSignal[]>>;
  latestToast: AdminNotification | null;
  setLatestToast: React.Dispatch<React.SetStateAction<AdminNotification | null>>;
}

export default function AdminWorkbench({
  currentUser,
  authToken,
  isDarkMode,
  onToggleDarkMode,
  onExitToClient,
  notifications,
  setNotifications,
  leads,
  setLeads,
  latestToast,
  setLatestToast
}: AdminWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>(() => {
    try {
      const saved = localStorage.getItem('pg_keyword_rules');
      return saved ? JSON.parse(saved) : INITIAL_KEYWORD_RULES;
    } catch {
      return INITIAL_KEYWORD_RULES;
    }
  });

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [activeIcpTarget, setActiveIcpTarget] = useState<string>('all');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [packageOverrideMap, setPackageOverrideMap] = useState<Record<string, ServicePackage['id']>>({});

  const [isScanningLive, setIsScanningLive] = useState(false);
  const [liveScanStatus, setLiveScanStatus] = useState<string | null>(null);
  const [showQuickIngest, setShowQuickIngest] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isDbSyncing, setIsDbSyncing] = useState(false);
  const [dbSyncStatus, setDbSyncStatus] = useState<string | null>(null);
  const [unreadInquiriesCount, setUnreadInquiriesCount] = useState(0);

  const [smartPasteText, setSmartPasteText] = useState('');
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [showManualFields, setShowManualFields] = useState(false);

  const [ingestName, setIngestName] = useState('');
  const [ingestHeadline, setIngestHeadline] = useState('');
  const [ingestLocation, setIngestLocation] = useState('');
  const [ingestSourceUrl, setIngestSourceUrl] = useState('');
  const [ingestText, setIngestText] = useState('');

  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const staticHosting = isStaticHostingMode();

  const getFreshToken = async (): Promise<string> => {
    try {
      const fresh = await currentUser.getIdToken();
      return fresh || authToken;
    } catch {
      return authToken;
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('pg_keyword_rules', JSON.stringify(keywordRules));
    } catch {}
  }, [keywordRules]);

  // Synchronize authenticated Admin data (backend + Firestore) cleanly without wiping existing local records
  useEffect(() => {
    let cancelled = false;

    async function hydrateAdminData() {
      const token = await getFreshToken();
      if (cancelled || !token) return;

      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      try {
        if (!staticHosting) {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL
            })
          });

          const [savedRes, inquiriesRes] = await Promise.all([
            fetch('/api/leads/saved', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/contact/inquiries', { headers: { Authorization: `Bearer ${token}` } })
          ]);

          const parsedSaved = await parseJsonApiResponse<{ leads?: any[] }>(savedRes);
          if (!cancelled && parsedSaved.ok && parsedSaved.data?.leads && Array.isArray(parsedSaved.data.leads) && parsedSaved.data.leads.length > 0) {
            const dbLeads = parsedSaved.data.leads;
            setLeads((prev) => {
              const prevIds = new Set(prev.map((p) => p.id));
              const fromDb = dbLeads.filter((d: any) => !prevIds.has(d.id));
              return [...prev, ...fromDb];
            });
          }

          const parsedInquiries = await parseJsonApiResponse<{ unreadCount?: number; inquiries?: any[] }>(inquiriesRes);
          if (!cancelled && parsedInquiries.ok && parsedInquiries.data) {
            const inqData = parsedInquiries.data;
            setUnreadInquiriesCount(Number(inqData.unreadCount || 0));
            if (inqData.inquiries && Array.isArray(inqData.inquiries) && inqData.inquiries.length > 0) {
              setNotifications((prev) => {
                const prevIds = new Set(prev.map((n) => n.id));
                const mapped: AdminNotification[] = inqData.inquiries!
                  .filter((inq: any) => !prevIds.has(`notif-${inq.id}`) && !prevIds.has(inq.id))
                  .map((inq: any) => ({
                    id: `notif-${inq.id}`,
                    title:
                      inq.inquiryType === 'complimentary_human_review'
                        ? `Human Review Request: ${inq.name}`
                        : `New Email Inquiry: ${inq.name}`,
                    subtitle: `${inq.service} · Persistent Inquiry`,
                    message: inq.message,
                    senderName: inq.name,
                    senderEmail: inq.email,
                    senderPhone: inq.phone,
                    service: inq.service,
                    urgency: inq.urgency,
                    leadId: `inbound-${inq.id}`,
                    timestamp: inq.timestamp ? new Date(inq.timestamp).toLocaleTimeString() : 'Recent',
                    createdAt: inq.timestamp ? new Date(inq.timestamp).getTime() : Date.now(),
                    isRead: Boolean(inq.isRead),
                    type: 'email_form' as const
                  }));
                return mapped.length > 0 ? [...mapped, ...prev] : prev;
              });
            }
          }
        }

        const [firestoreResult, firestoreRulesResult] = await Promise.all([
          fetchAdminLeadsFromFirestore(currentUser),
          fetchAdminKeywordRulesFromFirestore(currentUser)
        ]);
        if (!cancelled && firestoreResult.leads.length > 0) {
          setLeads((prev) => mergeLocalAndCloudRecords(prev, firestoreResult.leads));
        }
        if (!cancelled && firestoreRulesResult.rules.length > 0) {
          setKeywordRules((prev) => mergeLocalAndCloudRecords(prev, firestoreRulesResult.rules));
        }
      } catch (err) {
        console.warn('Admin hydration warning:', err);
      }
    }

    hydrateAdminData();
    if (!staticHosting) {
      handleScanICP('all');
    }

    return () => {
      cancelled = true;
    };
  }, [currentUser.uid, staticHosting]);

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
    if (staticHosting) return;
    try {
      const token = await getFreshToken();
      const rawId = id.startsWith('notif-') ? id.slice('notif-'.length) : id;
      const current = notifications.find((n) => n.id === id);
      await fetch(`/api/contact/inquiries/${encodeURIComponent(rawId)}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isRead: current ? !current.isRead : true })
      });
    } catch {}
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleExportBackup = async () => {
    try {
      let serverSnapshot: ServerBackupSnapshot | null = null;
      if (!staticHosting) {
        const token = await getFreshToken();
        if (token) {
          try {
            const res = await fetch('/api/admin/backup/snapshot', {
              headers: { Authorization: `Bearer ${token}` }
            });
            const parsed = await parseJsonApiResponse<{ snapshot?: ServerBackupSnapshot }>(res);
            if (parsed.ok && parsed.data?.snapshot) {
              serverSnapshot = parsed.data.snapshot;
            }
          } catch {}
        }
      }

      const bundle = await buildClientDataBackup(window.localStorage, serverSnapshot);
      const validation = await validateBackupBundle(bundle);
      if (!validation.valid) {
        setDbSyncStatus(`Backup integrity check failed: ${validation.errors.join(', ')}`);
        setTimeout(() => setDbSyncStatus(null), 5000);
        return;
      }

      const filename = triggerBackupDownload(bundle);
      setDbSyncStatus(
        `Exported ${filename} (${bundle.counts.leads} leads, ${bundle.counts.notifications} alerts, ${bundle.counts.clientRequests} requests)`
      );
      setTimeout(() => setDbSyncStatus(null), 5000);
    } catch (err) {
      console.warn('Backup export error:', err);
      setDbSyncStatus('Could not generate data backup JSON.');
      setTimeout(() => setDbSyncStatus(null), 4000);
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await restoreClientDataBackup(parsed, window.localStorage);
      if (!result.restored) {
        setDbSyncStatus(`Restore rejected: ${result.errors.join(', ')}`);
        setTimeout(() => setDbSyncStatus(null), 5000);
        return;
      }

      const reloadedLeads = JSON.parse(localStorage.getItem('pg_lead_signals') || '[]');
      const reloadedRules = JSON.parse(localStorage.getItem('pg_keyword_rules') || '[]');
      const reloadedNotifs = JSON.parse(localStorage.getItem('pg_admin_notifications') || '[]');
      if (Array.isArray(reloadedLeads)) setLeads(reloadedLeads);
      if (Array.isArray(reloadedRules) && reloadedRules.length > 0) setKeywordRules(reloadedRules);
      if (Array.isArray(reloadedNotifs)) setNotifications(reloadedNotifs);

      setDbSyncStatus(
        `Restored backup cleanly (${result.mergedCounts.leads} leads, ${result.mergedCounts.notifications} alerts, ${result.mergedCounts.clientRequests} requests)`
      );
      setTimeout(() => setDbSyncStatus(null), 5000);
    } catch (err: any) {
      setDbSyncStatus(`Could not import backup JSON: ${err?.message || 'Invalid JSON'}`);
      setTimeout(() => setDbSyncStatus(null), 5000);
    }
  };

  const handleSyncAllToFirestore = async () => {
    setIsDbSyncing(true);
    try {
      if (leads.length === 0 && keywordRules.length === 0) {
        setDbSyncStatus('No local leads or keyword rules to sync; Firestore and browser records unchanged.');
        setTimeout(() => setDbSyncStatus(null), 5000);
        return;
      }

      const leadsWithScores = leads.map((l) => {
        const analysis = analyzeSignalText(l.rawText, l.headline, keywordRules);
        return { ...l, fitScore: analysis.score };
      });
      const result = await syncAdminRecordsToFirestore(
        { leads: leadsWithScores, keywordRules },
        currentUser
      );
      if (result.errors.length > 0 && result.leadsSynced === 0 && result.rulesSynced === 0) {
        setDbSyncStatus(
          `Firestore sync deferred (rules awaiting deployment); localStorage preserved safely.`
        );
      } else {
        setDbSyncStatus(
          `Synced ${result.leadsSynced} leads & ${result.rulesSynced} keyword rules to Firestore.`
        );
      }
      setTimeout(() => setDbSyncStatus(null), 5000);
    } finally {
      setIsDbSyncing(false);
    }
  };

  const handleSaveLeadToDatabase = async (lead: any) => {
    setIsDbSyncing(true);
    try {
      if (staticHosting) {
        const firestoreRes = await saveLeadToFirestore(
          {
            ...lead,
            recommendedPackageId: lead.effectivePackage?.id || lead.recommendedPackageId || 'revamp_99',
            fitScore: lead.analysis?.score || 50
          },
          currentUser
        );
        if (firestoreRes.saved) {
          setDbSyncStatus('Lead saved securely to Firebase Firestore & localStorage.');
        } else {
          setDbSyncStatus('Local copy preserved (Firestore rules or network check needed).');
        }
        setTimeout(() => setDbSyncStatus(null), 4000);
        return;
      }

      const token = await getFreshToken();
      const [apiRes, firestoreRes] = await Promise.all([
        fetch('/api/leads/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: lead.id,
            personName: lead.personName,
            headline: lead.headline,
            location: lead.location,
            sourceType: lead.sourceType,
            sourceContext: lead.sourceContext,
            sourceUrl: lead.sourceUrl,
            authorUrl: lead.authorUrl,
            rawText: lead.rawText,
            yearsExperience: lead.yearsExperience,
            isHealthcareOrOps: lead.isHealthcareOrOps,
            detectedCluster: lead.detectedCluster || 'general',
            status: lead.status,
            recommendedPackageId: lead.effectivePackage?.id || lead.recommendedPackageId || 'revamp_99',
            fitScore: lead.analysis?.score || 50,
            diagnosticBottleNeck: lead.diagnosticBottleNeck,
            dutyVsContributionGap: lead.dutyVsContributionGap,
            diagnosticQuestionToAsk: lead.diagnosticQuestionToAsk,
            publicCommentDraft: lead.publicCommentDraft,
            warmDmDraft: lead.warmDmDraft
          })
        }),
        saveLeadToFirestore(
          {
            ...lead,
            recommendedPackageId: lead.effectivePackage?.id || lead.recommendedPackageId || 'revamp_99',
            fitScore: lead.analysis?.score || 50
          },
          currentUser
        )
      ]);

      if (apiRes.ok && firestoreRes.saved) {
        setDbSyncStatus('Lead saved securely to Firestore & backend store.');
      } else if (apiRes.ok) {
        setDbSyncStatus('Lead saved to authenticated backend & localStorage (Firestore rules pending deploy).');
      } else {
        setDbSyncStatus('Could not confirm remote save; local copy preserved.');
      }
      setTimeout(() => setDbSyncStatus(null), 4000);
    } catch (err) {
      console.warn('DB save failed:', err);
    } finally {
      setIsDbSyncing(false);
    }
  };

  const enrichedLeads = useMemo(() => {
    return leads.map((lead) => {
      const analysis = analyzeSignalText(lead.rawText, lead.headline, keywordRules);
      const effectivePkgId = packageOverrideMap[lead.id] || lead.recommendedPackageId;
      const effectivePackage =
        PURPOSE_GLOW_PACKAGES.find((p) => p.id === effectivePkgId) || PURPOSE_GLOW_PACKAGES[2];
      return {
        ...lead,
        analysis,
        effectivePackage
      };
    });
  }, [leads, keywordRules, packageOverrideMap]);

  const filteredLeads = useMemo(() => {
    return enrichedLeads.filter((lead) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          lead.personName.toLowerCase().includes(q) ||
          lead.headline.toLowerCase().includes(q) ||
          lead.rawText.toLowerCase().includes(q) ||
          lead.location.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (activeIcpTarget !== 'all') {
        if (activeIcpTarget === 'healthcare_rcm') {
          const isMatch =
            lead.detectedCluster === 'healthcare_rcm' ||
            lead.isHealthcareOrOps ||
            /healthcare|medical|billing|denial|clinic|cpc|claims|ehr|epic|rhia|hospital|coder/i.test(
              `${lead.headline} ${lead.rawText}`
            );
          if (!isMatch) return false;
        } else if (activeIcpTarget === 'career_pivot') {
          const isMatch =
            lead.detectedCluster === 'career_pivot' ||
            (lead.yearsExperience !== undefined && lead.yearsExperience >= 7) ||
            /pivot|transition|tenured|10 years|15 years|career change|transferable/i.test(
              `${lead.headline} ${lead.rawText}`
            );
          if (!isMatch) return false;
        } else if (activeIcpTarget === 'layoff_urgent') {
          const isMatch =
            lead.detectedCluster === 'layoff_urgent' ||
            /layoff|laid off|downsized|severance|unemployed/i.test(
              `${lead.headline} ${lead.rawText}`
            );
          if (!isMatch) return false;
        } else if (activeIcpTarget === 'student_grad') {
          const isMatch =
            lead.detectedCluster === 'student_grad' ||
            (lead.yearsExperience !== undefined && lead.yearsExperience <= 2) ||
            /student|grad|entry|intern|capstone|0 yoe|1 yoe|first job/i.test(
              `${lead.headline} ${lead.rawText}`
            );
          if (!isMatch) return false;
        }
      }

      if (feedFilter === 'qualified_buyers') {
        return lead.status !== 'filtered_noise' && lead.analysis.score >= 50;
      }
      if (feedFilter === 'live_stream') {
        return lead.isRealTimeLive === true && lead.status !== 'filtered_noise';
      }
      if (feedFilter === 'healthcare_niche') {
        return (lead.isHealthcareOrOps || lead.detectedCluster === 'healthcare_rcm') && lead.status !== 'filtered_noise';
      }
      if (feedFilter === 'in_conversation') {
        return lead.status === 'diagnostic_sent' || lead.status === 'diy_review_offered';
      }
      if (feedFilter === 'booked') {
        return lead.status === 'booked_client';
      }
      if (feedFilter === 'noise_filtered') {
        return lead.status === 'filtered_noise' || lead.analysis.score < 35;
      }
      return true;
    });
  }, [enrichedLeads, activeIcpTarget, feedFilter, searchQuery]);

  const selectedLead = useMemo(() => {
    return (
      enrichedLeads.find((l) => l.id === selectedLeadId) ||
      filteredLeads[0] ||
      enrichedLeads[0]
    );
  }, [enrichedLeads, filteredLeads, selectedLeadId]);

  const stats = useMemo(() => {
    const qualified = enrichedLeads.filter(
      (l) => l.status !== 'filtered_noise' && l.analysis.score >= 55
    );
    const liveStreamCount = enrichedLeads.filter(
      (l) => l.isRealTimeLive && l.status !== 'filtered_noise'
    ).length;
    const healthcareCount = qualified.filter((l) => l.isHealthcareOrOps).length;
    const filteredNoiseCount = enrichedLeads.filter(
      (l) => l.status === 'filtered_noise' || l.analysis.score < 40
    ).length;
    const pipelineValue = qualified.reduce(
      (sum, item) => sum + (item.effectivePackage.price || 99),
      0
    );
    const bookedRevenue = enrichedLeads
      .filter((l) => l.status === 'booked_client')
      .reduce((sum, item) => sum + (item.effectivePackage.price || 99), 0);

    return {
      qualifiedCount: qualified.length,
      liveStreamCount,
      healthcareCount,
      filteredNoiseCount,
      pipelineValue,
      bookedRevenue
    };
  }, [enrichedLeads]);

  const handleCopy = async (text: string, key: string) => {
    await safeCopyToClipboard(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleUpdateLeadStatus = (leadId: string, newStatus: LeadSignal['status']) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
  };

  const handleToggleRule = (id: string) => {
    setKeywordRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleAddRule = (rule: KeywordRule) => {
    setKeywordRules((prev) => [rule, ...prev]);
  };

  const handleDeleteRule = (id: string) => {
    setKeywordRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddLeadToPipeline = (newLead: LeadSignal) => {
    setLeads((prev) => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
    setFeedFilter('all');
    setActiveTab('feed');
  };

  const handleScanICP = async (cluster: string = 'all') => {
    if (staticHosting) {
      setActiveIcpTarget(cluster);
      setActiveTab('feed');
      setSearchQuery('');
      setFeedFilter('all');
      setLiveScanStatus(
        'Static Hosting Mode: Express server RSS scanner is paused. Use Live Qualifier, 1-Click Presets, or Manual Fields.'
      );
      setTimeout(() => setLiveScanStatus(null), 4500);
      return;
    }

    setIsScanningLive(true);
    setActiveIcpTarget(cluster);
    setActiveTab('feed');
    setSearchQuery('');
    setFeedFilter('all');

    const clusterLabel =
      cluster === 'all'
        ? 'All ICP Targets'
        : cluster === 'healthcare_rcm'
        ? 'Healthcare Operations & RCM'
        : cluster === 'career_pivot'
        ? 'Career Pivoters (8-15+ Yrs)'
        : cluster === 'layoff_urgent'
        ? 'Recent Layoffs & Urgent Re-entry'
        : 'Students & Early Healthcare Grads';

    setLiveScanStatus(`Scanning live public candidate discussions for ${clusterLabel}...`);

    const safetyTimer = setTimeout(() => {
      setIsScanningLive(false);
    }, 6000);

    try {
      const token = await getFreshToken();
      const res = await fetch(`/api/signals/scan-icp?cluster=${encodeURIComponent(cluster)}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.signals && Array.isArray(data.signals) && data.signals.length > 0) {
        const newLiveSignals: LeadSignal[] = data.signals.map((s: any) => {
          const analysis = analyzeSignalText(s.rawText, s.headline, keywordRules);
          return {
            id: s.id,
            personName: s.personName,
            headline: s.headline,
            location: s.location || 'United States / Remote',
            sourceType: s.sourceType || 'Reddit r/resumes',
            sourceContext: s.sourceContext,
            sourceUrl: s.sourceUrl,
            authorUrl: s.authorUrl,
            isRealTimeLive: true,
            verificationStatus: 'live_verified',
            timestamp: s.timestamp,
            rawText: s.rawText,
            yearsExperience: s.yearsExperience || 5,
            isHealthcareOrOps: s.isHealthcareOrOps || s.detectedCluster === 'healthcare_rcm',
            detectedCluster: s.detectedCluster,
            hasExistingResume: true,
            status: analysis.score >= 45 ? 'new_signal' : 'filtered_noise',
            recommendedPackageId: analysis.recommendedPackage.id,
            diagnosticBottleNeck: analysis.detectedBottleneck,
            dutyVsContributionGap: analysis.dutyVsContributionInsight,
            diagnosticQuestionToAsk: analysis.diagnosticQuestion,
            publicCommentDraft: analysis.suggestedPublicReply,
            warmDmDraft: analysis.suggestedWarmDm
          };
        });

        setLeads((prev) => {
          const newSignalIds = new Set(newLiveSignals.map((n) => n.id));
          const retainedOld = prev.filter((p) => p && !newSignalIds.has(p.id));
          return [...newLiveSignals, ...retainedOld];
        });

        setLiveScanStatus(`Discovered ${newLiveSignals.length} real live candidate signals for ${clusterLabel}!`);
        if (newLiveSignals[0]) {
          setSelectedLeadId(newLiveSignals[0].id);
        }
      } else {
        setLiveScanStatus(`Live scan finished. Feed synchronized with active candidate requests.`);
      }
    } catch (err: any) {
      console.warn('Live scan error:', err);
      setLiveScanStatus('Live scan finished. Feed refreshed with saved pipeline records.');
    } finally {
      clearTimeout(safetyTimer);
      setIsScanningLive(false);
      setTimeout(() => setLiveScanStatus(null), 4500);
    }
  };

  const handleScanLinkedIn = async (topic: string, label: string) => {
    if (staticHosting) {
      setActiveTab('feed');
      setLiveScanStatus(
        `Static Hosting Mode: Express LinkedIn server scanner is paused. Use the external search arrow icon or Manual Fields ingest.`
      );
      setTimeout(() => setLiveScanStatus(null), 4500);
      return;
    }

    setIsScanningLive(true);
    setActiveTab('feed');
    setSearchQuery('');
    setFeedFilter('all');
    setLiveScanStatus(`Scanning LinkedIn live candidate signals for "${label}"...`);

    const safetyTimer = setTimeout(() => {
      setIsScanningLive(false);
    }, 6000);

    try {
      const token = await getFreshToken();
      const res = await fetch(`/api/signals/scan-linkedin?topic=${encodeURIComponent(topic)}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.signals && Array.isArray(data.signals) && data.signals.length > 0) {
        const newLiveSignals: LeadSignal[] = data.signals.map((s: any) => {
          const analysis = analyzeSignalText(s.rawText, s.headline, keywordRules);
          return {
            id: s.id,
            personName: s.personName,
            headline: s.headline,
            location: s.location || 'United States / Remote',
            sourceType: s.sourceType || 'Public LinkedIn Post',
            sourceContext: s.sourceContext,
            sourceUrl: s.sourceUrl,
            authorUrl: s.authorUrl,
            isRealTimeLive: true,
            verificationStatus: 'live_verified',
            timestamp: s.timestamp || 'Just now',
            rawText: s.rawText,
            yearsExperience: s.yearsExperience || 5,
            isHealthcareOrOps: s.isHealthcareOrOps || s.detectedCluster === 'healthcare_rcm',
            detectedCluster: s.detectedCluster,
            hasExistingResume: true,
            status: analysis.score >= 45 ? 'new_signal' : 'filtered_noise',
            recommendedPackageId: s.recommendedPackageId || analysis.recommendedPackage.id,
            diagnosticBottleNeck: s.diagnosticBottleNeck || analysis.detectedBottleneck,
            dutyVsContributionGap: s.dutyVsContributionGap || analysis.dutyVsContributionInsight,
            diagnosticQuestionToAsk: s.diagnosticQuestionToAsk || analysis.diagnosticQuestion,
            publicCommentDraft: s.publicCommentDraft || analysis.suggestedPublicReply,
            warmDmDraft: s.warmDmDraft || analysis.suggestedWarmDm
          };
        });

        setLeads((prev) => {
          const newSignalIds = new Set(newLiveSignals.map((n) => n.id));
          const retainedOld = prev.filter((p) => p && !newSignalIds.has(p.id));
          return [...newLiveSignals, ...retainedOld];
        });

        setLiveScanStatus(`Discovered ${newLiveSignals.length} active LinkedIn candidate signals for "${label}"!`);
        if (newLiveSignals[0]) {
          setSelectedLeadId(newLiveSignals[0].id);
        }
      } else {
        setLiveScanStatus(`LinkedIn scan completed. Feed synchronized.`);
      }
    } catch (err) {
      console.warn('LinkedIn scan error:', err);
      setLiveScanStatus(`LinkedIn scan completed.`);
    } finally {
      clearTimeout(safetyTimer);
      setIsScanningLive(false);
      setTimeout(() => setLiveScanStatus(null), 4500);
    }
  };

  const handleInjectPreset = (preset: typeof ONE_CLICK_ICP_PRESETS[0]) => {
    const analysis = analyzeSignalText(preset.rawText, preset.headline, keywordRules);
    const newLead: LeadSignal = {
      id: `lead-preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      personName: preset.name,
      headline: preset.headline,
      location: preset.location,
      sourceType: 'Public LinkedIn Post',
      sourceContext: `1-Click Ingested ICP: ${preset.badge}`,
      sourceUrl: preset.sourceUrl,
      isRealTimeLive: true,
      verificationStatus: 'user_ingested',
      timestamp: 'Just now',
      rawText: preset.rawText,
      yearsExperience: preset.cluster === 'student_grad' ? 1 : preset.cluster === 'layoff_urgent' ? 5 : 8,
      isHealthcareOrOps: true,
      detectedCluster: preset.cluster as any,
      hasExistingResume: true,
      status: 'new_signal',
      recommendedPackageId: analysis.recommendedPackage.id,
      diagnosticBottleNeck: analysis.detectedBottleneck,
      dutyVsContributionGap: analysis.dutyVsContributionInsight,
      diagnosticQuestionToAsk: analysis.diagnosticQuestion,
      publicCommentDraft: analysis.suggestedPublicReply,
      warmDmDraft: analysis.suggestedWarmDm
    };

    setLeads((prev) => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
    setShowQuickIngest(false);
    setActiveTab('feed');
    setFeedFilter('all');
    setLiveScanStatus(`Added 1-click candidate "${preset.name}" (${preset.badge}) to your pipeline!`);
    setTimeout(() => setLiveScanStatus(null), 3500);
  };

  const handleAutoParsePastedText = async () => {
    if (!smartPasteText.trim()) return;
    if (staticHosting) {
      setShowManualFields(true);
      setIngestText(smartPasteText.trim());
      setLiveScanStatus(
        'Static Hosting Mode: Server auto-parser paused — pasted text copied into Manual Fields below.'
      );
      setTimeout(() => setLiveScanStatus(null), 4500);
      return;
    }
    setIsAutoParsing(true);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/signals/parse-paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pastedText: smartPasteText })
      });
      const parsedRes = await parseJsonApiResponse<{ lead?: any }>(res);
      if (!parsedRes.ok || !parsedRes.data) throw new Error(`HTTP ${parsedRes.status}`);
      const data = parsedRes.data;
      if (data.lead) {
        const parsed = data.lead;
        const analysis = analyzeSignalText(parsed.rawText, parsed.headline, keywordRules);
        const newLead: LeadSignal = {
          id: parsed.id || `lead-parsed-${Date.now()}`,
          personName: parsed.personName,
          headline: parsed.headline,
          location: parsed.location,
          sourceType: 'Public LinkedIn Post',
          sourceContext: parsed.sourceContext || 'Auto-parsed from pasted text (0 typing)',
          sourceUrl: parsed.sourceUrl || 'https://www.linkedin.com/feed/',
          authorUrl: parsed.authorUrl,
          isRealTimeLive: true,
          verificationStatus: 'user_ingested',
          timestamp: 'Just now',
          rawText: parsed.rawText,
          yearsExperience: parsed.yearsExperience || 5,
          isHealthcareOrOps: parsed.isHealthcareOrOps || false,
          detectedCluster: parsed.detectedCluster || 'general',
          hasExistingResume: true,
          status: analysis.score >= 45 ? 'new_signal' : 'filtered_noise',
          recommendedPackageId: analysis.recommendedPackage.id,
          diagnosticBottleNeck: analysis.detectedBottleneck,
          dutyVsContributionGap: analysis.dutyVsContributionInsight,
          diagnosticQuestionToAsk: analysis.diagnosticQuestion,
          publicCommentDraft: analysis.suggestedPublicReply,
          warmDmDraft: analysis.suggestedWarmDm
        };

        setLeads((prev) => [newLead, ...prev]);
        setSelectedLeadId(newLead.id);
        setShowQuickIngest(false);
        setSmartPasteText('');
        setActiveTab('feed');
        setFeedFilter('all');
        setLiveScanStatus(`Auto-parsed & qualified "${newLead.personName}" with 0 manual typing!`);
        setTimeout(() => setLiveScanStatus(null), 3500);
      }
    } catch (err) {
      console.error('Failed to auto-parse:', err);
    } finally {
      setIsAutoParsing(false);
    }
  };

  const handleQuickIngestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestText.trim()) return;

    const analysis = analyzeSignalText(ingestText, ingestHeadline, keywordRules);
    const newLead: LeadSignal = {
      id: `lead-user-${Date.now()}`,
      personName: ingestName.trim() || 'LinkedIn Contact',
      headline: ingestHeadline.trim() || 'Professional Job Seeker',
      location: ingestLocation.trim() || 'Remote / US',
      sourceType: 'Comment on Your Post',
      sourceContext: ingestSourceUrl.trim()
        ? `Ingested from real live post: ${ingestSourceUrl.trim()}`
        : 'Ingested directly from your LinkedIn notifications',
      sourceUrl: ingestSourceUrl.trim() || 'https://www.linkedin.com/feed/',
      isRealTimeLive: true,
      verificationStatus: 'user_ingested',
      timestamp: 'Just now',
      rawText: ingestText.trim(),
      yearsExperience: 6,
      isHealthcareOrOps: /healthcare|revenue|denials|billing|clinic|compliance|operations/i.test(
        `${ingestHeadline} ${ingestText}`
      ),
      hasExistingResume: !/haven't updated|from scratch|no resume/i.test(ingestText),
      status: analysis.score >= 50 ? 'new_signal' : 'filtered_noise',
      recommendedPackageId: analysis.recommendedPackage.id,
      diagnosticBottleNeck: analysis.detectedBottleneck,
      dutyVsContributionGap: analysis.dutyVsContributionInsight,
      diagnosticQuestionToAsk: analysis.diagnosticQuestion,
      publicCommentDraft: analysis.suggestedPublicReply,
      warmDmDraft: analysis.suggestedWarmDm
    };

    setLeads((prev) => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
    setShowQuickIngest(false);
    setIngestText('');
    setIngestName('');
    setIngestHeadline('');
    setIngestSourceUrl('');
  };

  const renderHighlightedSignalText = (text: string, matchedRules: KeywordRule[]) => {
    if (!matchedRules.length) return text;
    const phrases = matchedRules
      .map((r) => r.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    if (!phrases.length) return text;

    const regex = new RegExp(`(${phrases.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const matchedRule = matchedRules.find(
        (r) => r.phrase.toLowerCase() === part.toLowerCase()
      );
      if (matchedRule) {
        return (
          <mark
            key={idx}
            className={
              matchedRule.weight >= 0
                ? 'bg-amber-200/75 text-slate-900 font-medium px-1 rounded-xs'
                : 'bg-slate-200 text-slate-600 line-through px-1 rounded-xs'
            }
          >
            {part}
          </mark>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${isDarkMode ? 'bg-[#0B0F19] text-slate-100 dark' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <input
        ref={restoreFileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportBackupFile}
        className="hidden"
        aria-hidden="true"
      />

      {/* Strict 3-Zone Top Bar Contract with Mobile Responsiveness */}
      <header className={`flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-8 px-3 sm:px-6 lg:px-10 py-2.5 sm:py-4 border-b sticky top-0 z-30 transition-colors ${isDarkMode ? 'bg-[#121624] border-[#22283A]' : 'bg-white border-slate-200'}`}>
        {/* Zone 1: Wordmark & Switch to Client Site */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onExitToClient}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs ${
              isDarkMode
                ? 'text-pink-300 bg-pink-950/40 hover:bg-pink-950/70 border border-pink-800/60'
                : 'text-[#9C1450] bg-[#FFF0F5] hover:bg-[#FCE1EC] border border-[#F0C6D6]'
            }`}
            title="Return to public website"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Public Site</span>
            <span className="sm:hidden">Site</span>
          </button>
          <div className={`h-4 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`} />
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('feed');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5 sm:gap-2"
          >
            <span>Purpose &amp; Glow</span>
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-teal-800 bg-teal-100/90 dark:bg-teal-950 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
              Admin
            </span>
          </a>
        </div>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="w-full lg:w-auto order-3 lg:order-2 flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 overflow-x-auto pb-1 pt-1 border-t lg:border-t-0 border-slate-200/50 dark:border-slate-800/50 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setActiveTab('feed');
              setFeedFilter('all');
              if (!staticHosting) {
                handleScanICP('all');
              }
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 text-xs sm:text-sm ${
              activeTab === 'feed'
                ? 'border-teal-800 dark:border-teal-400 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white text-slate-500'
            }`}
          >
            Signal Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qualifier')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 text-xs sm:text-sm ${
              activeTab === 'qualifier'
                ? 'border-teal-800 dark:border-teal-400 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white text-slate-500'
            }`}
          >
            Live Qualifier
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('keywords')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 text-xs sm:text-sm ${
              activeTab === 'keywords'
                ? 'border-teal-800 dark:border-teal-400 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white text-slate-500'
            }`}
          >
            Keyword Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cadence')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 text-xs sm:text-sm ${
              activeTab === 'cadence'
                ? 'border-teal-800 dark:border-teal-400 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white text-slate-500'
            }`}
          >
            Capacity &amp; Boundaries
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assessments')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 text-xs sm:text-sm ${
              activeTab === 'assessments'
                ? 'border-teal-800 dark:border-teal-400 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white text-slate-500'
            }`}
          >
            Assessment Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inquiries')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 text-xs sm:text-sm inline-flex items-center gap-1.5 ${
              activeTab === 'inquiries'
                ? 'border-[#C2185B] dark:border-pink-400 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white text-slate-500'
            }`}
          >
            <span>Inquiries</span>
            {unreadInquiriesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#C2185B] text-white text-[10px] font-mono font-bold">
                {unreadInquiriesCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Alerts, Dark Mode, Copilot, Backup/Restore, Firestore Sync, Ingest, & Auth */}
        <div className="order-2 lg:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`relative px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
              notifications.some((n) => !n.isRead)
                ? isDarkMode
                  ? 'bg-[#C2185B]/20 border-[#C2185B]/50 text-pink-300'
                  : 'bg-pink-50 border-pink-200 text-[#C2185B]'
                : isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Inbound Inquiries & Alerts"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Alerts</span>
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#C2185B] text-white text-[10px] font-mono font-bold flex items-center justify-center animate-pulse">
                {notifications.filter((n) => !n.isRead).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <button
            type="button"
            onClick={() => setIsCopilotOpen(true)}
            disabled={staticHosting}
            title={
              staticHosting
                ? 'AI Copilot requires the Express API backend (paused in static hosting mode)'
                : 'Open Gemini Diagnostic Copilot'
            }
            className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'bg-teal-950/40 border-teal-800 text-teal-300 hover:bg-teal-950/70'
                : 'text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
            <span>{staticHosting ? 'AI Copilot (API Only)' : 'AI Copilot'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportBackup}
            title="Download verified JSON backup of client requests, leads, rules, and alerts"
            className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden xl:inline">Backup Data</span>
          </button>

          <button
            type="button"
            onClick={() => restoreFileInputRef.current?.click()}
            title="Restore & merge records from a saved backup JSON file"
            className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden xl:inline">Restore</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAllToFirestore}
            disabled={isDbSyncing}
            title="Sync leads and rules to Firebase Firestore"
            className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden xl:inline">Sync Cloud</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuickIngest(true)}
            className="px-3 py-2 text-xs font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ingest</span>
          </button>

          <div className={`flex items-center gap-2 pl-2 border-l ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title={`Verified Admin: ${currentUser.email}`} />
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'Admin'}
                className="w-7 h-7 rounded-full border border-teal-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-semibold">
                {(currentUser.displayName || currentUser.email || 'N')[0].toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={async () => {
                await logOut();
                onExitToClient();
              }}
              title="Sign out of Admin Google Session"
              className={`text-xs font-medium cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <AdminNotificationsPopover
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationRead}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onClearAll={handleClearNotifications}
        onSelectLead={(leadId) => {
          setSelectedLeadId(leadId);
          setActiveTab('qualifier');
        }}
        isAudioEnabled={isAudioEnabled}
        onToggleAudio={() => setIsAudioEnabled(!isAudioEnabled)}
        isDarkMode={isDarkMode}
      />

      {latestToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-bounce-short shadow-2xl rounded-2xl overflow-hidden border border-[#C2185B]/40 bg-white dark:bg-[#151926] text-slate-900 dark:text-slate-100"
        >
          <div className="bg-[#FFF0F5] dark:bg-[#1F2538] px-4 py-2.5 border-b border-[#F0C6D6] dark:border-[#2E3650] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C2185B] animate-ping" />
              <span className="text-xs font-bold text-[#C2185B] dark:text-pink-300">
                New Inbound Lead Received!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLatestToast(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">{latestToast.senderName}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/70 text-[#C2185B] dark:text-pink-300 font-semibold">
                {latestToast.service}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic">
              "{latestToast.message}"
            </p>
            <div className="pt-2 flex items-center justify-between gap-2">
              {latestToast.leadId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeadId(latestToast.leadId!);
                    setActiveTab('qualifier');
                    setLatestToast(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#C2185B] hover:bg-[#9C1450] text-white transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  <span>Open Lead &amp; Qualify</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
              <a
                href={`mailto:${latestToast.senderEmail}?subject=Purpose & Glow Consultation`}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              >
                Reply ({latestToast.senderEmail})
              </a>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <section className={`rounded-xl p-6 space-y-6 border transition-colors ${isDarkMode ? 'bg-[#121624] border-[#22283A] text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className={`flex flex-wrap items-center gap-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>Nicole Gotsch · Founder, Purpose &amp; Glow Career Solutions</span>
                <span aria-hidden="true">·</span>
                <span>Brooklyn Park, MN</span>
                <span aria-hidden="true">·</span>
                <a
                  href="https://purposeglowcareer.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isDarkMode ? 'text-teal-400 hover:text-teal-300' : 'text-teal-800 hover:underline'} inline-flex items-center gap-1`}
                >
                  purposeglowcareer.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <h1
                className={`text-2xl sm:text-3xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                style={{ textWrap: 'balance' }}
              >
                Turn Real Live Candidate Signals Into Paying Clients
              </h1>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                “A résumé problem is not always an experience problem. Sometimes it is a communication problem.” This workbench monitors real public job seeker discussions and incoming LinkedIn engagement to qualify actual buying intent for your <strong>$50 Student</strong>, <strong>$99 Résumé Revamp</strong>, and <strong>$145 Created From Scratch</strong> packages.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
              <div className={`inline-flex rounded-lg border p-0.5 overflow-x-auto max-w-full transition-colors ${
                isDarkMode
                  ? 'bg-[#121622] border-[#252C3E]'
                  : 'bg-teal-50 border-teal-200'
              }`}>
                <button
                  type="button"
                  onClick={() => handleScanICP('all')}
                  disabled={isScanningLive || staticHosting}
                  title={
                    staticHosting
                      ? 'Express RSS scanner paused in static hosting mode'
                      : 'Scan all Ideal Customer Profiles'
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                    activeIcpTarget === 'all'
                      ? isDarkMode
                        ? 'bg-teal-500 text-slate-950 shadow-xs'
                        : 'bg-teal-900 text-white shadow-xs'
                      : isDarkMode
                        ? 'text-slate-300 hover:text-white hover:bg-[#1C2234]'
                        : 'text-teal-950 hover:bg-teal-100/80'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningLive ? 'animate-spin' : ''}`} />
                  {staticHosting ? 'RSS Scanner (API Only)' : isScanningLive ? 'Scanning...' : 'Scan All ICPs'}
                </button>
                <div className={`h-4 w-px self-center mx-1 ${isDarkMode ? 'bg-[#252C3E]' : 'bg-teal-200'}`} />
                <button
                  type="button"
                  onClick={() => (staticHosting ? setActiveIcpTarget('healthcare_rcm') : handleScanICP('healthcare_rcm'))}
                  disabled={isScanningLive}
                  title="Filter or scan Medical Billers, Denial Analysts, and Clinic Supervisors"
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
                    activeIcpTarget === 'healthcare_rcm'
                      ? isDarkMode
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-teal-900 text-white font-semibold'
                      : isDarkMode
                        ? 'text-slate-300 hover:text-white hover:bg-[#1C2234] font-medium'
                        : 'text-teal-900 hover:bg-teal-100/80 font-medium'
                  }`}
                >
                  Healthcare RCM
                </button>
                <button
                  type="button"
                  onClick={() => (staticHosting ? setActiveIcpTarget('career_pivot') : handleScanICP('career_pivot'))}
                  disabled={isScanningLive}
                  title="Filter or scan 8–15+ Year Tenured Managers and Career Pivoters"
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
                    activeIcpTarget === 'career_pivot'
                      ? isDarkMode
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-teal-900 text-white font-semibold'
                      : isDarkMode
                        ? 'text-slate-300 hover:text-white hover:bg-[#1C2234] font-medium'
                        : 'text-teal-900 hover:bg-teal-100/80 font-medium'
                  }`}
                >
                  Career Pivoters (8-15+ Yrs)
                </button>
                <button
                  type="button"
                  onClick={() => (staticHosting ? setActiveIcpTarget('layoff_urgent') : handleScanICP('layoff_urgent'))}
                  disabled={isScanningLive}
                  title="Filter or scan Recent Layoffs & Urgent Re-entry"
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
                    activeIcpTarget === 'layoff_urgent'
                      ? isDarkMode
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-teal-900 text-white font-semibold'
                      : isDarkMode
                        ? 'text-slate-300 hover:text-white hover:bg-[#1C2234] font-medium'
                        : 'text-teal-900 hover:bg-teal-100/80 font-medium'
                  }`}
                >
                  Recent Layoffs
                </button>
                <button
                  type="button"
                  onClick={() => (staticHosting ? setActiveIcpTarget('student_grad') : handleScanICP('student_grad'))}
                  disabled={isScanningLive}
                  title="Filter or scan Early Healthcare Grads & Students"
                  className={`px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
                    activeIcpTarget === 'student_grad'
                      ? isDarkMode
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'bg-teal-900 text-white font-semibold'
                      : isDarkMode
                        ? 'text-slate-300 hover:text-white hover:bg-[#1C2234] font-medium'
                        : 'text-teal-900 hover:bg-teal-100/80 font-medium'
                  }`}
                >
                  Students &amp; Grads
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickIngest(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs ${
                  isDarkMode
                    ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold'
                    : 'text-white bg-teal-900 hover:bg-teal-950'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Ingest LinkedIn Signal
              </button>
            </div>
          </div>

          {staticHosting && (
            <div
              role="status"
              className={`p-3.5 border rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                isDarkMode
                  ? 'bg-[#181D2C] border-amber-700/60 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div>
                <strong>Spark Static Mode Active ($0 Firebase Hosting):</strong> Live Firebase Auth, Firestore Sync, Live Qualifier, Keyword Rules, Boundaries, and JSON Backup/Restore work natively. Server-side RSS/LinkedIn scanning, AI Copilot, Inquiries API, and Assessment Telemetry are paused until Express backend activation.
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3 py-1.5 rounded-md bg-amber-900/10 hover:bg-amber-900/20 border border-current font-semibold shrink-0 cursor-pointer"
              >
                Download JSON Backup
              </button>
            </div>
          )}

          {liveScanStatus && (
            <div className={`p-3 border rounded-lg text-xs flex items-center justify-between ${
              isDarkMode
                ? 'bg-[#101826] border-teal-800/60 text-teal-200'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}>
              <span>{liveScanStatus}</span>
              <span className={`font-mono text-[11px] ${isDarkMode ? 'text-teal-400' : 'text-teal-700'}`}>Authenticated API</span>
            </div>
          )}

          {dbSyncStatus && (
            <div className={`p-3 border rounded-lg text-xs flex items-center justify-between ${
              isDarkMode
                ? 'bg-emerald-950/50 border-emerald-800/70 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {dbSyncStatus}
              </span>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">Backup / Cloud Sync</span>
            </div>
          )}

          <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-xs border ${isDarkMode ? 'bg-[#181C2C] border-[#252B3E] text-slate-300' : 'bg-slate-100/90 border-slate-200 text-slate-700'}`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Live Rad Feeds Monitored:</span>
              <span className="text-slate-400 hidden sm:inline">Active public forums scanned in real-time</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { name: 'r/MedicalCoding ↗', url: 'https://www.reddit.com/r/MedicalCoding/new' },
                { name: 'r/healthIT ↗', url: 'https://www.reddit.com/r/healthIT/new' },
                { name: 'r/resumes ↗', url: 'https://www.reddit.com/r/resumes/new' },
                { name: 'r/careerguidance ↗', url: 'https://www.reddit.com/r/careerguidance/new' },
                { name: 'r/jobs ↗', url: 'https://www.reddit.com/r/jobs/new' }
              ].map((feed) => (
                <a
                  key={feed.name}
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-2 py-1 rounded transition-colors inline-flex items-center gap-1 font-mono text-[11px] border ${
                    isDarkMode
                      ? 'bg-[#121624] hover:bg-[#1E2336] text-slate-200 border-[#2A3148]'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {feed.name}
                </a>
              ))}
            </div>
          </div>

          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-6 pt-5 border-t ${isDarkMode ? 'border-[#22283A]' : 'border-slate-200'}`}>
            <div>
              <span className={`block text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Qualified Paying Prospects
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-semibold font-mono tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {stats.qualifiedCount}
                </span>
                <span className={`text-xs font-medium ${isDarkMode ? 'text-teal-400' : 'text-teal-800'}`}>
                  Active communication bottlenecks
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs text-slate-500">
                Healthcare RCM &amp; Ops Matches
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold font-mono tabular-nums text-teal-800">
                  {stats.healthcareCount}
                </span>
                <span className="text-xs text-slate-500">
                  12+ yr shared domain trust
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs text-slate-500">
                Passive Applause Filtered Out
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold font-mono tabular-nums text-slate-700">
                  {stats.filteredNoiseCount}
                </span>
                <span className="text-xs text-slate-500">
                  Saved from non-buyer DMs
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs text-slate-500">
                Qualified Package Pipeline
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold font-mono tabular-nums text-teal-800">
                  ${stats.pipelineValue.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {stats.bookedRevenue > 0
                    ? `· $${stats.bookedRevenue} booked`
                    : '· $50 / $99 / $145 tiers'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={`rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-colors ${
          isDarkMode
            ? 'bg-[#121622] border-[#22283A]'
            : 'bg-slate-50/80 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 shrink-0 animate-pulse ${isDarkMode ? 'text-teal-400' : 'text-teal-800'}`} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Live LinkedIn Candidate Scanner
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  isDarkMode
                    ? 'bg-teal-950/80 text-teal-300 border border-teal-800/80'
                    : 'bg-teal-100 text-teal-800'
                }`}>
                  1-Click Active
                </span>
              </div>
              <span className={`text-xs hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Click any topic below to run the live scanner and populate qualified candidates immediately
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {LIVE_LINKEDIN_LAUNCHERS.map((launcher) => (
              <div
                key={launcher.topic}
                className={`inline-flex items-center rounded-lg border overflow-hidden shadow-2xs transition-colors ${
                  isDarkMode
                    ? 'border-[#273044] bg-[#181D2C] hover:border-teal-400'
                    : 'border-slate-200 bg-white hover:border-teal-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleScanLinkedIn(launcher.topic, launcher.label)}
                  disabled={isScanningLive || staticHosting}
                  title={
                    staticHosting
                      ? `Express LinkedIn scanner paused — use the external LinkedIn arrow on the right`
                      : `Run live in-app scan for ${launcher.label}`
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap ${
                    isDarkMode
                      ? 'text-slate-200 hover:text-white hover:bg-[#20273A]'
                      : 'text-slate-800 hover:text-teal-900 hover:bg-teal-50/70'
                  }`}
                >
                  <Search className={`w-3 h-3 shrink-0 ${isDarkMode ? 'text-teal-400' : 'text-teal-700'}`} />
                  <span>{launcher.label}</span>
                </button>
                <a
                  href={launcher.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open "${launcher.label}" search on LinkedIn in a new tab`}
                  className={`px-2 py-1.5 border-l transition-colors ${
                    isDarkMode
                      ? 'border-[#273044] text-slate-400 hover:text-teal-300 hover:bg-[#20273A]'
                      : 'border-slate-200 text-slate-400 hover:text-teal-800 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {showQuickIngest && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className={`border rounded-xl max-w-xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto transition-colors ${
              isDarkMode
                ? 'bg-[#121622] border-[#252C3E] text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-[#252C3E]' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Ingest Signal (Zero Typing)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickIngest(false)}
                  className={`text-xs p-1 rounded transition-colors cursor-pointer ${
                    isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#1E2538]' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Close
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-semibold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    <span>1-Click Verified ICP Candidates</span>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:border dark:border-emerald-800 px-1.5 py-0.2 rounded font-semibold">0 Typing</span>
                  </label>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Instant qualification</span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Click any verified candidate profile below to insert them into your live pipeline with full diagnostic breakdown:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {ONE_CLICK_ICP_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleInjectPreset(preset)}
                      className={`p-2.5 text-left border rounded-lg transition-all cursor-pointer group shadow-2xs ${
                        isDarkMode
                          ? 'bg-[#181D2C] hover:bg-[#20273A] border-[#283146] hover:border-teal-400'
                          : 'bg-slate-50 hover:bg-teal-50/80 border-slate-200 hover:border-teal-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-xs font-bold truncate ${
                          isDarkMode ? 'text-slate-100 group-hover:text-teal-300' : 'text-slate-900 group-hover:text-teal-900'
                        }`}>
                          {preset.name}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                          isDarkMode ? 'bg-teal-950 text-teal-300 border border-teal-800' : 'text-teal-800 bg-teal-100'
                        }`}>
                          {preset.badge}
                        </span>
                      </div>
                      <p className={`text-[11px] line-clamp-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {preset.headline}
                      </p>
                      <p className={`text-[10px] mt-1 italic line-clamp-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        “{preset.rawText.slice(0, 75)}...”
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className={`flex-grow border-t ${isDarkMode ? 'border-[#252C3E]' : 'border-slate-200'}`} />
                <span className="flex-shrink mx-3 text-xs font-medium text-slate-400 uppercase tracking-wider">or paste anything</span>
                <div className={`flex-grow border-t ${isDarkMode ? 'border-[#252C3E]' : 'border-slate-200'}`} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    Smart Paste Box (Auto-Extracts Name, Role &amp; Pain Points)
                  </label>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Paste raw post or message</span>
                </div>
                <textarea
                  rows={3}
                  value={smartPasteText}
                  onChange={(e) => setSmartPasteText(e.target.value)}
                  placeholder="Paste a candidate's LinkedIn comment, DM, or post text here... the engine extracts their background, calculates package fit, and creates drafts automatically."
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none leading-relaxed font-sans transition-colors ${
                    isDarkMode
                      ? 'bg-[#181D2C] border-[#283146] text-slate-100 focus:border-teal-400 placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-teal-700 placeholder:text-slate-400'
                  }`}
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowManualFields(!showManualFields)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer underline"
                  >
                    {showManualFields ? 'Hide manual fields' : 'Advanced: Show individual fields'}
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoParsePastedText}
                    disabled={isAutoParsing || !smartPasteText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {staticHosting
                        ? 'Copy Text to Manual Form'
                        : isAutoParsing
                        ? 'Auto-Parsing...'
                        : 'Auto-Parse & Qualify (1 Click)'}
                    </span>
                  </button>
                </div>
              </div>

              {showManualFields && (
                <form onSubmit={handleQuickIngestSubmit} className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Person Name
                      </label>
                      <input
                        type="text"
                        value={ingestName}
                        onChange={(e) => setIngestName(e.target.value)}
                        placeholder="e.g. Candidate Name"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-teal-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Headline / Role
                      </label>
                      <input
                        type="text"
                        value={ingestHeadline}
                        onChange={(e) => setIngestHeadline(e.target.value)}
                        placeholder="e.g. Certified Coder & Denial Specialist"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-teal-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Location
                      </label>
                      <input
                        type="text"
                        value={ingestLocation}
                        onChange={(e) => setIngestLocation(e.target.value)}
                        placeholder="Minneapolis, MN"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-teal-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Post URL
                      </label>
                      <input
                        type="url"
                        value={ingestSourceUrl}
                        onChange={(e) => setIngestSourceUrl(e.target.value)}
                        placeholder="https://www.linkedin.com/..."
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-teal-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Verbatim Text
                    </label>
                    <textarea
                      rows={2}
                      value={ingestText}
                      onChange={(e) => setIngestText(e.target.value)}
                      placeholder="Comment text..."
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-teal-700 font-sans"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={!ingestText.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      Submit Custom Lead
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'feed' && (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFeedFilter('qualified_buyers')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feedFilter === 'qualified_buyers'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Paying Prospects ({stats.qualifiedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('live_stream')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    feedFilter === 'live_stream'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Web Stream ({stats.liveStreamCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('healthcare_niche')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feedFilter === 'healthcare_niche'
                      ? isDarkMode ? 'bg-teal-500 text-slate-950 font-bold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Healthcare RCM &amp; Ops ({stats.healthcareCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('in_conversation')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feedFilter === 'in_conversation'
                      ? isDarkMode ? 'bg-teal-500 text-slate-950 font-bold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Diagnostic Sent / DIY Review
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('booked')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feedFilter === 'booked'
                      ? isDarkMode ? 'bg-teal-500 text-slate-950 font-bold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Booked Clients
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('noise_filtered')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feedFilter === 'noise_filtered'
                      ? isDarkMode ? 'bg-teal-500 text-slate-950 font-bold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Filtered Noise ({stats.filteredNoiseCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feedFilter === 'all'
                      ? isDarkMode ? 'bg-teal-500 text-slate-950 font-bold shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Signals ({enrichedLeads.length})
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keyword, role, or city..."
                  className={`w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-[#141926] border-[#252C3E] text-slate-100 focus:border-teal-400 placeholder:text-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-teal-700 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className={`lg:col-span-5 border rounded-xl overflow-hidden transition-colors ${
                isDarkMode ? 'bg-[#121622] border-[#22283A] divide-y divide-[#22283A]' : 'bg-white border-slate-200 divide-y divide-slate-200'
              }`}>
                {filteredLeads.length === 0 ? (
                  <div className="p-8 text-center space-y-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                      isDarkMode ? 'bg-teal-950/60 border border-teal-800 text-teal-300' : 'bg-teal-50 border border-teal-200 text-teal-800'
                    }`}>
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {isScanningLive
                          ? 'Scanning Live Discussions for ICP Candidates...'
                          : 'No active signals in this filter'}
                      </p>
                      <p className={`text-xs max-w-xs mx-auto leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Execute a live scan across Nicole’s 4 Ideal Customer Profiles or ingest a candidate directly from LinkedIn.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleScanICP('all')}
                        disabled={isScanningLive || staticHosting}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDarkMode ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold' : 'bg-teal-900 hover:bg-teal-950 text-white'
                        }`}
                      >
                        {staticHosting ? 'RSS Scanner (API Only)' : isScanningLive ? 'Scanning...' : 'Scan All ICPs'}
                      </button>
                      <button
                        type="button"
                        onClick={() => (staticHosting ? setActiveIcpTarget('healthcare_rcm') : handleScanICP('healthcare_rcm'))}
                        disabled={isScanningLive}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-60 ${
                          isDarkMode
                            ? 'bg-[#181D2C] hover:bg-[#20273A] text-teal-300 border border-teal-800/60'
                            : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200'
                        }`}
                      >
                        Healthcare RCM
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickIngest(true)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                          isDarkMode ? 'bg-[#181D2C] hover:bg-[#20273A] text-slate-200 border border-[#273044]' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        Ingest Signal
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredLeads.map((item) => {
                    const isSelected = selectedLead?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedLeadId(item.id)}
                        className={`p-5 transition-colors cursor-pointer ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-teal-950/30 border-l-4 border-teal-400'
                              : 'bg-teal-50/50'
                            : isDarkMode
                            ? 'hover:bg-[#181E2E]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {item.sourceType}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{item.timestamp}</span>
                            {item.detectedCluster && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isDarkMode
                                    ? 'bg-teal-950/80 text-teal-300 border border-teal-800'
                                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                                }`}>
                                  {item.detectedCluster === 'healthcare_rcm'
                                    ? 'Healthcare RCM'
                                    : item.detectedCluster === 'career_pivot'
                                    ? 'Career Pivot (8-15+ YoE)'
                                    : item.detectedCluster === 'layoff_urgent'
                                    ? 'Recent Layoff'
                                    : item.detectedCluster === 'student_grad'
                                    ? 'Student / Early Grad'
                                    : 'Active Critique'}
                                </span>
                              </>
                            )}
                            {item.isRealTimeLive && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'} font-semibold inline-flex items-center gap-1`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Live
                                </span>
                              </>
                            )}
                          </div>
                          <span
                            className={`font-mono font-semibold tabular-nums shrink-0 ${
                              item.analysis.score >= 68
                                ? isDarkMode ? 'text-teal-400' : 'text-teal-800'
                                : item.analysis.score >= 40
                                ? isDarkMode ? 'text-amber-400' : 'text-amber-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {item.analysis.score}/100 fit
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className={`text-base font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.personName}
                          </h3>
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`text-xs font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1 shrink-0 transition-colors ${
                                isDarkMode
                                  ? 'text-teal-300 bg-teal-950/80 hover:bg-teal-900 border border-teal-800'
                                  : 'text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200'
                              }`}
                            >
                              Live Post
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <p className={`text-xs mt-0.5 line-clamp-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          {item.headline}
                        </p>

                        <p className={`text-xs mt-2.5 line-clamp-2 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          “{item.rawText}”
                        </p>

                        <div className={`flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t text-xs ${
                          isDarkMode ? 'border-[#22283A] text-slate-400' : 'border-slate-100 text-slate-500'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {item.effectivePackage.name} ({item.effectivePackage.priceDisplay})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.analysis.matchedPositiveRules.length} trigger keywords
                            </span>
                          </div>
                          <span className={`font-medium ${isDarkMode ? 'text-teal-400' : 'text-teal-800'}`}>
                            {item.status === 'new_lead' || item.status === 'new_signal'
                              ? 'New Lead'
                              : item.status === 'contacted' || item.status === 'diagnostic_sent'
                              ? 'Contacted'
                              : item.status === 'interested' || item.status === 'diy_review_offered'
                              ? 'Interested'
                              : item.status === 'follow_up_needed'
                              ? 'Follow-Up Needed'
                              : item.status === 'client' || item.status === 'booked_client'
                              ? 'Active Client'
                              : item.status === 'completed'
                              ? 'Completed'
                              : item.status === 'not_interested'
                              ? 'Not Interested'
                              : item.status === 'closed' || item.status === 'filtered_noise'
                              ? 'Closed'
                              : 'Lead'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedLead && (
                <div className={`lg:col-span-7 border rounded-xl p-6 space-y-6 transition-colors ${
                  isDarkMode
                    ? 'bg-[#121622] border-[#22283A] text-slate-100'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}>
                  <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b ${
                    isDarkMode ? 'border-[#22283A]' : 'border-slate-200'
                  }`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                        <span className={`font-medium px-2 py-0.5 rounded border ${
                          isDarkMode
                            ? 'bg-teal-950/80 text-teal-300 border border-teal-800'
                            : 'text-teal-900 bg-teal-50 border border-teal-200'
                        }`}>{selectedLead.sourceType}</span>
                        {selectedLead.detectedCluster && (
                          <span className={`font-semibold px-2 py-0.5 rounded border ${
                            isDarkMode
                              ? 'bg-teal-950/90 text-teal-200 border border-teal-700'
                              : 'text-teal-900 bg-teal-100/90 border border-teal-300'
                          }`}>
                            {selectedLead.detectedCluster === 'healthcare_rcm'
                              ? 'ICP: Healthcare RCM'
                              : selectedLead.detectedCluster === 'career_pivot'
                              ? 'ICP: Career Pivot (8-15+ YoE)'
                              : selectedLead.detectedCluster === 'layoff_urgent'
                              ? 'ICP: Recent Layoff'
                              : selectedLead.detectedCluster === 'student_grad'
                              ? 'ICP: Student / Early Grad ($50)'
                              : 'ICP: Active Résumé Review'}
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{selectedLead.location}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-mono tabular-nums ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {selectedLead.yearsExperience} yrs exp
                        </span>
                      </div>
                      <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {selectedLead.personName}
                      </h2>
                      <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {selectedLead.headline}
                      </p>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Context: {selectedLead.sourceContext}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <label className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Conversion Stage:
                      </label>
                      <select
                        value={selectedLead.status}
                        onChange={(e) =>
                          handleUpdateLeadStatus(
                            selectedLead.id,
                            e.target.value as LeadSignal['status']
                          )
                        }
                        className={`px-3 py-1.5 text-xs font-medium border rounded-lg focus:outline-none cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-[#181D2C] border-[#273044] text-slate-100 focus:border-teal-400'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-teal-700'
                        }`}
                      >
                        <option value="new_signal">New Lead</option>
                        <option value="contacted">Contacted</option>
                        <option value="interested">Interested</option>
                        <option value="follow_up_needed">Follow-Up Needed</option>
                        <option value="booked_client">Active Client</option>
                        <option value="completed">Completed</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="filtered_noise">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className={`p-3.5 border rounded-lg flex flex-wrap items-center justify-between gap-3 ${
                    isDarkMode ? 'bg-[#181D2C] border-[#252C3E]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Verified Live Discussion
                      </span>
                      <span className={`text-xs hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        · Real public thread active now
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCopilotOpen(true)}
                        disabled={staticHosting}
                        title={
                          staticHosting
                            ? 'AI Copilot requires the Express API backend'
                            : 'Ask Gemini Diagnostic Copilot'
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDarkMode
                            ? 'bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-800'
                            : 'bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-200'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                        <span>{staticHosting ? 'Ask Copilot (API Only)' : 'Ask Copilot'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveLeadToDatabase(selectedLead)}
                        disabled={isDbSyncing}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                          isDarkMode
                            ? 'bg-[#1E2536] hover:bg-[#283246] text-slate-200 border border-[#2F3A52]'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5 text-teal-400" />
                        <span>{isDbSyncing ? 'Saving...' : 'Save Lead'}</span>
                      </button>

                      {selectedLead.sourceUrl && (
                        <a
                          href={selectedLead.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs ${
                            isDarkMode
                              ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold'
                              : 'bg-teal-900 hover:bg-teal-950 text-white'
                          }`}
                        >
                          <span>Open Live Post</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {selectedLead.authorUrl && (
                        <a
                          href={selectedLead.authorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                            isDarkMode
                              ? 'bg-[#1E2536] hover:bg-[#283246] text-slate-200 border border-[#2F3A52]'
                              : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                          }`}
                        >
                          <span>Author</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pb-6 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Captured Verbatim Text (Trigger Keywords Highlighted)
                      </span>
                      <span className="text-xs font-mono tabular-nums text-teal-800 dark:text-teal-400 font-semibold">
                        Intent Score: {selectedLead.analysis.score}/100
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg text-sm text-slate-800 leading-relaxed">
                      “{renderHighlightedSignalText(selectedLead.rawText, [
                        ...selectedLead.analysis.matchedPositiveRules,
                        ...selectedLead.analysis.matchedNegativeRules
                      ])}”
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Matched Signals:
                      </span>
                      {selectedLead.analysis.matchedPositiveRules.length > 0 ? (
                        selectedLead.analysis.matchedPositiveRules.map((rule, idx) => (
                          <React.Fragment key={rule.id}>
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>
                              {rule.phrase}{' '}
                              <strong className="font-mono text-teal-800 dark:text-teal-400 tabular-nums">
                                (+{rule.weight})
                              </strong>
                            </span>
                          </React.Fragment>
                        ))
                      ) : (
                        <span>None</span>
                      )}
                      {selectedLead.isHealthcareOrOps && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-teal-800 dark:text-teal-400 font-medium">
                            Healthcare / Ops Shared Context (+12)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                        01. Communication Bottleneck Diagnosis
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedLead.diagnosticBottleNeck}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                        02. Job Duties vs. Actual Contributions Gap
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedLead.dutyVsContributionGap}
                      </p>
                    </div>
                  </div>

                  <div className="pb-6 border-b border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          03. Recommended Purpose &amp; Glow Offer
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          · Click any package to tailor the outreach script below
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-teal-800 dark:text-teal-400 font-semibold">
                        Turnaround: {selectedLead.effectivePackage.turnaround}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {PURPOSE_GLOW_PACKAGES.map((pkg) => {
                        const isCurrent = selectedLead.effectivePackage.id === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() =>
                              setPackageOverrideMap((prev) => ({
                                ...prev,
                                [selectedLead.id]: pkg.id
                              }))
                            }
                            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-teal-50/70 border-teal-800 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {pkg.name.replace('Résumé ', '')}
                              </span>
                              <span className="text-xs font-mono font-semibold text-teal-800 tabular-nums shrink-0">
                                {pkg.priceDisplay}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                              {pkg.turnaround}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-teal-800 dark:text-teal-400">
                          Concrete Diagnostic Question (Use in Comment or First DM)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              selectedLead.diagnosticQuestionToAsk,
                              `q-${selectedLead.id}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                        >
                          {copiedId === `q-${selectedLead.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-teal-700" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Question
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                        “{selectedLead.diagnosticQuestionToAsk}”
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Public LinkedIn Reply
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            · Builds authority &amp; invites the DM naturally
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleCopy(
                              selectedLead.publicCommentDraft,
                              `pub-${selectedLead.id}`
                            );
                            if (selectedLead.status === 'new_signal') {
                              handleUpdateLeadStatus(selectedLead.id, 'diagnostic_sent');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-md transition-colors cursor-pointer"
                        >
                          {copiedId === `pub-${selectedLead.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-teal-700" />
                              Copied &amp; Marked Sent
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Public Reply
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200/80 leading-relaxed whitespace-pre-line">
                        {selectedLead.publicCommentDraft}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Warm Service-First DM Bridge
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            · Pairs Free DIY Recommendations with {selectedLead.effectivePackage.name} ({selectedLead.effectivePackage.priceDisplay})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleCopy(
                              selectedLead.warmDmDraft,
                              `dm-${selectedLead.id}`
                            );
                            if (
                              selectedLead.status === 'new_signal' ||
                              selectedLead.status === 'diagnostic_sent'
                            ) {
                              handleUpdateLeadStatus(
                                selectedLead.id,
                                'diy_review_offered'
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-teal-800 hover:bg-teal-900 text-white rounded-md transition-colors cursor-pointer"
                        >
                          {copiedId === `dm-${selectedLead.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Copied DM Bridge
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Warm DM
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200/80 leading-relaxed whitespace-pre-line">
                        {selectedLead.warmDmDraft}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'qualifier' && (
          <LiveQualifierPanel
            keywordRules={keywordRules}
            onAddLeadToPipeline={handleAddLeadToPipeline}
          />
        )}

        {activeTab === 'keywords' && (
          <KeywordRulesManager
            rules={keywordRules}
            onToggleRule={handleToggleRule}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
          />
        )}

        {activeTab === 'cadence' && (
          <CadenceBoundaryPlanner
            leads={leads}
            onSelectLeadForAction={(leadId) => {
              setSelectedLeadId(leadId);
              setActiveTab('feed');
            }}
          />
        )}

        {activeTab === 'assessments' && (
          <AssessmentActivityPanel
            getFreshToken={getFreshToken}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'inquiries' && (
          <InquiryManagementPanel
            getFreshToken={getFreshToken}
            isDarkMode={isDarkMode}
            onUnreadCountChange={setUnreadInquiriesCount}
          />
        )}
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-6 px-6 lg:px-10">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">
              Purpose &amp; Glow Career Solutions
            </span>
            <span aria-hidden="true">·</span>
            <span>Live Signal Monitoring &amp; Lead Qualification Studio</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://purposeglowcareer.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors inline-flex items-center gap-1"
            >
              purposeglowcareer.com
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            {!staticHosting && (
              <a
                href="/assets/aistudio/Nicole_MINDPRINT_Intelligence_Report_3a181470.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 transition-colors inline-flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                Mindprint Intelligence Report
              </a>
            )}
          </div>
        </div>
      </footer>

      <GeminiCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        selectedLead={selectedLead}
        authToken={authToken}
      />
    </div>
  );
}
