/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LeadSignal } from './data/purposeGlowData';
import { auth, isVerifiedAdminUser, testFirestoreConnection } from './lib/firebase.ts';
import { ClientFacingSite } from './components/ClientFacingSite';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AdminNotification } from './components/AdminNotificationsPopover';

const AdminWorkbench = React.lazy(() => import('./components/AdminWorkbench'));

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<'client' | 'admin'>('client');

  const isAdminAuthenticated = isVerifiedAdminUser(currentUser) && Boolean(authToken);

  // Dark mode state shared between client website and admin studio
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pg_theme');
      if (saved) return saved === 'dark';
      return (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    } catch {
      return false;
    }
  });

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pg_theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Persistent Admin Notifications (zero fake pre-seeded PII)
  const [notifications, setNotifications] = useState<AdminNotification[]>(() => {
    try {
      const saved = localStorage.getItem('pg_admin_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });

  const [latestToast, setLatestToast] = useState<AdminNotification | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('pg_admin_notifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  // Persistent Admin Lead Pipeline (preserves existing user records)
  const [leads, setLeads] = useState<LeadSignal[]>(() => {
    try {
      const saved = localStorage.getItem('pg_lead_signals');
      if (saved) {
        const parsed: LeadSignal[] = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pg_lead_signals', JSON.stringify(leads));
    } catch {}
  }, [leads]);

  // Firebase Auth Session Listener (sole source of Admin authorization)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && isVerifiedAdminUser(user)) {
        try {
          const token = await user.getIdToken();
          setAuthToken(token);
          if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            const params = new URLSearchParams(window.location.search);
            if (hash === '#admin' || params.get('view') === 'admin') {
              setCurrentView('admin');
            }
          }
        } catch (err) {
          console.warn('Could not retrieve Firebase ID token:', err);
          setAuthToken(null);
        }
      } else {
        setAuthToken(null);
        setCurrentView('client');
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Validate Firestore connectivity on initial boot
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  // Hash navigation listener enforcing verified Firebase Admin authentication
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin') {
        if (isAdminAuthenticated) {
          setCurrentView('admin');
        } else if (authReady) {
          setShowAdminAuthModal(true);
        }
      } else if (window.location.hash === '#client' || window.location.hash === '#home') {
        setCurrentView('client');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isAdminAuthenticated, authReady]);

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated) {
      setCurrentView('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowAdminAuthModal(true);
    }
  };

  const handleAdminAuthSuccess = async () => {
    const activeUser = auth.currentUser;
    if (activeUser && isVerifiedAdminUser(activeUser)) {
      const token = await activeUser.getIdToken();
      setCurrentUser(activeUser);
      setAuthToken(token);
      setShowAdminAuthModal(false);
      setCurrentView('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleExitToClient = () => {
    setCurrentView('client');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInboundClientLead = (lead: {
    first: string;
    email: string;
    service: string;
    note: string;
    id: string;
    phone?: string;
    urgency?: string;
  }) => {
    const newLead: LeadSignal = {
      id: `inbound-${lead.id}`,
      personName: lead.first,
      headline: `Client Inquiry: ${lead.service}`,
      location: 'United States / Remote',
      sourceType: 'Inbound Consultation Request',
      sourceContext: `Submitted on Purpose & Glow Website (${lead.service})`,
      sourceUrl: 'https://purposeglowcareer.com/#contact',
      isRealTimeLive: true,
      verificationStatus: 'user_ingested',
      timestamp: 'Just now',
      rawText: lead.note
        ? `${lead.note} (Email: ${lead.email}${lead.phone ? ` | Phone: ${lead.phone}` : ''})`
        : `Inbound inquiry for ${lead.service}. Contact: ${lead.email}${lead.phone ? ` | Phone: ${lead.phone}` : ''}`,
      yearsExperience: 5,
      isHealthcareOrOps: /healthcare|clinic|billing|operations|rcm/i.test(`${lead.service} ${lead.note}`),
      detectedCluster: /student/i.test(lead.service)
        ? 'student_grad'
        : /scratch/i.test(lead.service)
        ? 'career_pivot'
        : 'healthcare_rcm',
      hasExistingResume: !/from scratch/i.test(lead.service),
      status: 'new_signal',
      recommendedPackageId: /student/i.test(lead.service)
        ? 'student_50'
        : /scratch/i.test(lead.service)
        ? 'scratch_145'
        : 'revamp_99',
      diagnosticBottleNeck: 'High-intent inbound client awaiting quotation and 45-min discovery scheduling.',
      dutyVsContributionGap: 'Direct client inquiry seeking customized résumé transformation and career strategy.',
      diagnosticQuestionToAsk: 'What target organizations or health systems are at the top of your wish list?',
      publicCommentDraft: `Hi ${lead.first}, thank you for reaching out to Purpose & Glow! I received your inquiry for the ${lead.service} and will follow up shortly.`,
      warmDmDraft: `Hi ${lead.first}, saw your request for the ${lead.service}. I have openings this week for my initial discovery call. What time works best for you?`
    };

    setLeads((prev) => [newLead, ...prev]);

    const newNotif: AdminNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `New Email Inquiry: ${lead.first}`,
      subtitle: `${lead.service} · Direct message to purposeandglowcareers@gmail.com`,
      message: lead.note || `Client inquiry for ${lead.service}.`,
      senderName: lead.first,
      senderEmail: lead.email,
      senderPhone: lead.phone,
      service: lead.service,
      urgency: lead.urgency,
      leadId: newLead.id,
      timestamp: 'Just now',
      createdAt: Date.now(),
      isRead: false,
      type: 'email_form'
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setLatestToast(newNotif);
    setTimeout(() => {
      setLatestToast((curr) => (curr?.id === newNotif.id ? null : curr));
    }, 7000);
  };

  if (currentView === 'admin' && isAdminAuthenticated && currentUser && authToken) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-700 dark:text-slate-200 text-sm">
            Loading verified Admin Workbench...
          </div>
        }
      >
        <AdminWorkbench
          currentUser={currentUser}
          authToken={authToken}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onExitToClient={handleExitToClient}
          notifications={notifications}
          setNotifications={setNotifications}
          leads={leads}
          setLeads={setLeads}
          latestToast={latestToast}
          setLatestToast={setLatestToast}
        />
      </Suspense>
    );
  }

  return (
    <>
      <ClientFacingSite
        onOpenAdmin={handleOpenAdmin}
        onInboundLeadSubmitted={handleInboundClientLead}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        adminAuthToken={isAdminAuthenticated ? authToken : null}
      />
      <AdminAuthModal
        isOpen={showAdminAuthModal}
        currentUser={currentUser}
        onSuccess={handleAdminAuthSuccess}
        onClose={() => setShowAdminAuthModal(false)}
      />
    </>
  );
}
