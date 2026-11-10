import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  OBSIDIAN_FILTERS,
  OBSIDIAN_SAMPLES,
  REAL_CLIENT_REVIEWS,
  SampleItem,
  ClientReview
} from '../data/obsidianData';
import {
  Lock,
  Mail,
  Moon,
  Sun,
  Calendar,
  ExternalLink,
  Check,
  CheckCircle2,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  FileText,
  Copy,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ArrowUp
} from 'lucide-react';
import { EmailInquiryModal, EmailInquiryData } from './EmailInquiryModal';
import { FreeAssessmentModal, AssessmentData } from './FreeAssessmentModal';
import { PromotionalBanner } from './PromotionalBanner';
import { FindYourServiceGuide } from './FindYourServiceGuide';
import { MobilePricingCards } from './MobilePricingCards';
import { PaymentMethodsBanner } from './PaymentMethodsBanner';
import { FaqAccordion } from './FaqAccordion';
import { CareerResourcesSection } from './CareerResourcesSection';
import { generateResumeSvg } from '../utils/obsidianSvg';
import '../styles/obsidian.css';

interface ClientFacingSiteProps {
  onOpenAdmin: () => void;
  onInboundLeadSubmitted?: (lead: {
    first: string;
    email: string;
    service: string;
    note: string;
    id: string;
    phone?: string;
    urgency?: string;
  }) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

interface RequestRecord {
  id: string;
  first: string;
  email: string;
  service: string;
  note: string;
  done: boolean;
  at: number;
}

export function ClientFacingSite({
  onOpenAdmin,
  onInboundLeadSubmitted,
  isDarkMode = false,
  onToggleDarkMode
}: ClientFacingSiteProps) {
  // Navigation & scroll progress states
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('home');
  const [activeSectionLabel, setActiveSectionLabel] = useState('Home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showToTop, setShowToTop] = useState(false);

  // Email Pop-Up Form Fill state attached to the email on the page
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalDefaultService, setEmailModalDefaultService] = useState('Résumé Revamp ($99)');

  const handleOpenEmailModal = (defaultService: string = 'Résumé Revamp ($99)') => {
    setEmailModalDefaultService(defaultService);
    setIsEmailModalOpen(true);
  };

  const handleEmailModalSuccess = (inquiry: EmailInquiryData) => {
    if (onInboundLeadSubmitted) {
      onInboundLeadSubmitted({
        first: inquiry.name,
        email: inquiry.email,
        service: inquiry.service,
        note: `${inquiry.message}${inquiry.targetRole ? ` [Target: ${inquiry.targetRole}]` : ''}${inquiry.currentRole ? ` [Current: ${inquiry.currentRole}]` : ''}`,
        id: inquiry.id || `inq-${Date.now()}`,
        phone: inquiry.phone,
        urgency: inquiry.urgency
      });
    }
  };

  // Free Career & Résumé Assessment state
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [pricingViewMode, setPricingViewMode] = useState<'cards' | 'table'>('cards');

  const handleAssessmentSuccess = (data: AssessmentData) => {
    if (onInboundLeadSubmitted) {
      onInboundLeadSubmitted({
        first: data.fullName,
        email: data.email,
        service: `Assessment: ${data.primaryAssistance}`,
        note: `[FREE ASSESSMENT] Target: ${data.targetTitles} | Current: ${data.currentTitle} (${data.yearsExperience}) | Preferred Ind: ${data.preferredIndustry} | Style: ${data.workStyle} | Salary: ${data.desiredSalary} | Notes: ${data.resumeNotes}`,
        id: data.id || `assess-${Date.now()}`,
        phone: data.phone,
        urgency: 'urgent_48h'
      });
    }
    showToast('Free assessment received! Nicole will email you shortly.');
  };

  // Review carousel in Section 02
  const [reviewIdx, setReviewIdx] = useState(0);
  const activeReview: ClientReview = REAL_CLIENT_REVIEWS[reviewIdx] || REAL_CLIENT_REVIEWS[0];

  // Portfolio states in Section 04
  const [portfolioFilter, setPortfolioFilter] = useState('all');
  const [shortlist, setShortlist] = useState<Record<string, { id: string; at: number }>>(() => {
    try {
      const saved = localStorage.getItem('pg_shortlist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);

  // Contact form & ledger in Section 06
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formService, setFormService] = useState('Professional Résumé Revamp — $99');
  const [formNote, setFormNote] = useState('');
  const [formStatus, setFormStatus] = useState<{ msg: string; isErr: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [requests, setRequests] = useState<Record<string, RequestRecord>>(() => {
    try {
      const saved = localStorage.getItem('pg_client_requests');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 3200);
  };

  // Track window scroll for progress rule and section readouts
  useEffect(() => {
    const handleScroll = () => {
      const h = document.documentElement;
      const b = document.body;
      const st = 'scrollTop';
      const sh = 'scrollHeight';
      const pct = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight);
      setScrollProgress(Math.min(1, Math.max(0, pct || 0)));
      setShowToTop((h[st] || b[st]) > 550);

      const sections: { id: string; label: string }[] = [
        { id: 'home', label: 'Home' },
        { id: 'work', label: 'Services' },
        { id: 'testimony', label: 'Client Reviews' },
        { id: 'process', label: 'Our Process' },
        { id: 'portfolio', label: 'Résumé Examples' },
        { id: 'pricing', label: 'Pricing' },
        { id: 'contact', label: 'Contact' }
      ];

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveSection(sections[i].id);
            setActiveSectionLabel(sections[i].label);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcut: Shift + C jumps directly to contact form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        e.preventDefault();
        const contactEl = document.getElementById('contact');
        if (contactEl) {
          contactEl.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => {
            document.getElementById('fName')?.focus();
          }, 400);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save shortlist & requests to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pg_shortlist', JSON.stringify(shortlist));
    } catch {}
  }, [shortlist]);

  useEffect(() => {
    try {
      localStorage.setItem('pg_client_requests', JSON.stringify(requests));
    } catch {}
  }, [requests]);

  const toggleShortlist = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShortlist((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        delete updated[id];
        showToast('Removed from your shortlist');
      } else {
        updated[id] = { id, at: Date.now() };
        showToast('Saved to your shortlist');
      }
      return updated;
    });
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      showToast(`Copied ${label} to clipboard`);
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      showToast(`Copy failed`);
    }
  };

  const visibleSamples = useMemo(() => {
    return OBSIDIAN_SAMPLES.filter((s) => {
      if (portfolioFilter === 'all') return true;
      if (portfolioFilter === 'shortlist') return !!shortlist[s.id];
      return s.cat === portfolioFilter;
    });
  }, [portfolioFilter, shortlist]);

  const handleSelectService = (serviceName: string) => {
    setFormService(serviceName);
    const contactEl = document.getElementById('contact');
    if (contactEl) {
      contactEl.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        const input = document.getElementById('fName');
        input?.focus();
      }, 500);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormStatus({ msg: 'Please enter your first name.', isErr: true });
      return;
    }
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail);
    if (!isValidEmail) {
      setFormStatus({ msg: 'Please enter a valid email address.', isErr: true });
      return;
    }

    setIsSubmitting(true);
    const newId = `req-${Date.now()}`;
    const newRecord: RequestRecord = {
      id: newId,
      first: formName.trim().slice(0, 60),
      email: formEmail.trim().slice(0, 120),
      service: formService,
      note: formNote.trim().slice(0, 800),
      done: false,
      at: Date.now()
    };

    setRequests((prev) => ({ [newId]: newRecord, ...prev }));
    setFormStatus({
      msg: `Thank you, ${newRecord.first} — your inquiry for "${newRecord.service}" has been queued for Purpose & Glow Career Solutions at purposeandglowcareers@gmail.com. We will reply within one business day.`,
      isErr: false
    });

    if (onInboundLeadSubmitted) {
      onInboundLeadSubmitted({
        first: newRecord.first,
        email: newRecord.email,
        service: newRecord.service,
        note: newRecord.note,
        id: newRecord.id
      });
    }

    // Save lead to local endpoint if available
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName: newRecord.first,
          headline: `Inbound Client: ${newRecord.service}`,
          location: 'United States / Remote',
          sourceType: 'Inbound Consultation Request',
          sourceContext: `Client request submitted via website form (${newRecord.service})`,
          sourceUrl: 'https://purposeglowcareer.com/#contact',
          rawText: newRecord.note || `Interested in: ${newRecord.service}. Contact: ${newRecord.email}`,
          yearsExperience: 5,
          isHealthcareOrOps: /healthcare|billing|clinic|ops/i.test(`${newRecord.service} ${newRecord.note}`),
          detectedCluster: /student/i.test(newRecord.service) ? 'student_grad' : /scratch/i.test(newRecord.service) ? 'career_pivot' : 'healthcare_rcm',
          recommendedPackageId: /student/i.test(newRecord.service) ? 'student_50' : /scratch/i.test(newRecord.service) ? 'scratch_145' : 'revamp_99',
          status: 'new_signal',
          fitScore: 98
        })
      });
    } catch (err) {
      console.warn('Could not post lead to server:', err);
    }

    // Send email dispatch to business email
    try {
      await fetch('/api/contact/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRecord.first,
          email: newRecord.email,
          service: newRecord.service,
          message: newRecord.note || `Consultation request for ${newRecord.service}`,
          urgency: 'standard_week',
          recipientEmail: 'purposeandglowcareers@gmail.com'
        })
      });
    } catch (err) {
      console.warn('Could not post inquiry to /api/contact/email:', err);
    }

    setFormName('');
    setFormEmail('');
    setFormNote('');
    setIsSubmitting(false);
  };

  const handleToggleRecordDone = (id: string) => {
    setRequests((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], done: !prev[id].done }
      };
    });
  };

  const handleDeleteRecord = (id: string) => {
    setRequests((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const requestList = useMemo(() => {
    return Object.values(requests).sort((a, b) => (b.at || 0) - (a.at || 0));
  }, [requests]);

  const openRequestsCount = requestList.filter((r) => !r.done).length;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Skip to Main Content Link */}
      <a href="#main" className="skip">Skip to main content</a>

      {/* Optional Top Promotional / Announcement Banner */}
      <PromotionalBanner
        onOpenAssessment={() => setIsAssessmentModalOpen(true)}
        isDarkMode={isDarkMode}
      />

      {/* Sticky Masthead with Signature Reading Progress Rule */}
      <header className="masthead" id="masthead">
        <div className="wrap mh-row">
          {/* Authentic Purpose & Glow Branding - Logo is primary branding on mobile */}
          <a href="#home" className="brand" aria-label="Purpose & Glow Career Solutions">
            <img
              src="/assets/branding/logo-1024.png"
              alt="Purpose & Glow Career Solutions"
              className="brand-logo"
            />
            <span className="brand-title">Purpose &amp; Glow <em>Career Solutions</em></span>
          </a>

          {/* Section Navigation */}
          <nav className="nav" aria-label="Primary navigation">
            <a href="#work" aria-current={activeSectionLabel === 'Services'}>Services</a>
            <a href="#testimony" aria-current={activeSectionLabel === 'Client Reviews'}>Client Reviews</a>
            <a href="#process" aria-current={activeSectionLabel === 'Our Process'}>Our Process</a>
            <a href="#portfolio" aria-current={activeSectionLabel === 'Résumé Examples'}>Résumé Examples</a>
            <a href="#pricing" aria-current={activeSectionLabel === 'Pricing'}>Pricing</a>
            <a href="#contact" aria-current={activeSectionLabel === 'Contact'}>Contact</a>
          </nav>

          {/* Action Hub & Live Section Readout */}
          <div className="mh-right">
            {/* Theme Toggle Button */}
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle dark mode"
                className="mh-theme-btn"
              >
                {isDarkMode ? <Sun style={{ width: '15px', height: '15px' }} /> : <Moon style={{ width: '15px', height: '15px' }} />}
              </button>
            )}

            {/* Direct Email Action Button */}
            <a
              href="mailto:purposeandglowcareers@gmail.com?subject=Purpose%20%26%20Glow%20Career%20Solutions%20Inquiry"
              title="Open a new message addressed to purposeandglowcareers@gmail.com"
              className="mh-email-btn"
            >
              <Mail style={{ width: '14px', height: '14px', stroke: 'currentColor' }} />
              <span className="mh-email-text">Email</span>
            </a>

            {/* Direct Calendly Intro Link */}
            <a
              href="https://calendly.com/purposeandglowcareers/career-consultation"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ink mh-calendly-btn"
              title="Book a free 15-minute consultation on Calendly"
            >
              <Calendar style={{ width: '15px', height: '15px' }} />
              <span>Book Intro</span>
              <ExternalLink style={{ width: '12px', height: '12px', opacity: 0.8 }} />
            </a>

            {/* Admin Area Button (available via mobile drawer menu on small screens) */}
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Open Backend Admin Studio"
              className="btn-line mh-admin-btn"
            >
              <Lock style={{ width: '14px', height: '14px' }} />
              <span>Admin</span>
            </button>

            {/* Section Position Readout */}
            <div className="readout" aria-live="polite">
              <b>{activeSectionLabel}</b>
            </div>

            {/* Mobile Navigation Trigger */}
            <button
              type="button"
              className="burger"
              id="burger"
              aria-label="Toggle navigation"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="sr-only">Toggle navigation</span>
              <svg viewBox="0 0 24 24" className="b-open" aria-hidden="true">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
              <svg viewBox="0 0 24 24" className="b-close" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Signature Interactive Reading Progress Rule with Section Ticks */}
        <div
          className="rule"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuenow={Math.round(scrollProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="rule-fill"
            id="ruleFill"
            style={{ transform: `scaleX(${scrollProgress})` }}
          />
          <div className="ticks" aria-hidden="true">
            {[
              { pos: '0%', id: 'home', label: 'Home' },
              { pos: '16.6%', id: 'work', label: 'Services' },
              { pos: '33.3%', id: 'testimony', label: 'Client Reviews' },
              { pos: '50.0%', id: 'process', label: 'Our Process' },
              { pos: '66.6%', id: 'portfolio', label: 'Résumé Examples' },
              { pos: '83.3%', id: 'pricing', label: 'Pricing' },
              { pos: '100%', id: 'contact', label: 'Contact' }
            ].map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`tick ${activeSection === t.id ? 'passed' : ''}`}
                style={{ left: t.pos }}
                title={`Jump to ${t.label}`}
              >
                <span className="tip">{t.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <nav
          className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}
          id="mobileNav"
          aria-label="Mobile navigation"
        >
          <div className="wrap">
            <ul>
              <li>
                <a href="#work" onClick={() => setIsMobileMenuOpen(false)}>
                  Services
                </a>
              </li>
              <li>
                <a href="#testimony" onClick={() => setIsMobileMenuOpen(false)}>
                  Client Reviews
                </a>
              </li>
              <li>
                <a href="#process" onClick={() => setIsMobileMenuOpen(false)}>
                  Our Process
                </a>
              </li>
              <li>
                <a href="#portfolio" onClick={() => setIsMobileMenuOpen(false)}>
                  Résumé Examples
                </a>
              </li>
              <li>
                <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>
                  Pricing
                </a>
              </li>
              <li>
                <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>
                  Contact
                </a>
              </li>
              <li style={{ paddingTop: '16px', borderTop: '1px solid var(--hair)' }}>
                <a
                  href="https://tally.so/r/q5a1RY"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ color: '#F06292', fontWeight: 700 }}
                >
                  Free Job Search Registration <span>Tally ↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://calendly.com/purposeandglowcareers/career-consultation"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ color: 'var(--red)', fontWeight: 700 }}
                >
                  Book a Free 15-Min Intro <span>Calendly ↗</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:purposeandglowcareers@gmail.com?subject=Purpose%20%26%20Glow%20Mobile%20Inquiry"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Direct Email <span>purposeandglowcareers@gmail.com</span>
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--hair)' }}
                >
                  <span style={{ fontFamily: 'var(--serif-d)', fontSize: '20px', fontWeight: 600 }}>Admin Area</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: '12px', color: 'var(--red)', fontWeight: 600 }}>Backend Studio</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      {/* Main Landmark */}
      <main id="main">
        {/* Section: Hero */}
        <section className="hero" id="home" data-sect data-label="Home">
          {/* Decorative solid geometric background with brand magenta/purple accents without thin vertical grid lines */}
          <div className="hero-accent" id="heroAccent" aria-hidden="true">
            <svg viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
              <polygon points="260,0 800,0 800,900 0,900" fill={isDarkMode ? '#131722' : '#FFF0F5'} />
              <polygon points="420,0 800,0 800,900 260,900" fill={isDarkMode ? '#1E2333' : '#FCD6E4'} opacity={isDarkMode ? '.8' : '.6'} />
            </svg>
          </div>

          <div className="wrap">
            {/* Hero Meta Bar */}
            <div className="hero-meta">
              <p className="label">
                <span>Purpose &amp; Glow Career Solutions</span>
                <span style={{ margin: '0 8px' }}>·</span>
                <span>Minnesota | Remote Services Nationwide</span>
              </p>
              <p className="label red">
                <span>Your Career. Your Purpose. Your Glow.</span>
              </p>
            </div>

            {/* Hero Grid & Editorial Typography */}
            <div className="hero-grid">
              <h1>
                Your experience deserves <em>more than a</em>
                <span className="line2">generic résumé.</span>
              </h1>

              <p className="lead dropcap">
                Purpose &amp; Glow Career Solutions transforms routine duty lists into quantifiable accomplishments that capture hiring managers' attention and sail through modern ATS filters. Whether you’re starting fresh, changing careers, or updating what you already have, I take the time to understand your background and what you’re looking for in your next opportunity.
              </p>

              <aside className="hero-aside">
                <dl>
                  <div>
                    <dt>Our Purpose</dt>
                    <dd>Helping you recognize the skills and accomplishments you already have, and presenting them with confidence.</dd>
                  </div>
                  <div>
                    <dt>Turnaround Window</dt>
                    <dd className="num">24–48 hours on revamps; 3–5 business days for ground-up creations.</dd>
                  </div>
                  <div>
                    <dt>Free Assessment</dt>
                    <dd>
                      <button
                        type="button"
                        onClick={() => setIsAssessmentModalOpen(true)}
                        className="ul"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--red)', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                        title="Open Free Career & Résumé Assessment"
                      >
                        Get Free Assessment ($0) →
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Direct Inquiries</dt>
                    <dd>
                      <a
                        href="mailto:purposeandglowcareers@gmail.com?subject=Purpose%20%26%20Glow%20Direct%20Inquiry"
                        className="ul"
                        title="Click to open a new message addressed to purposeandglowcareers@gmail.com"
                      >
                        purposeandglowcareers@gmail.com
                      </a>
                    </dd>
                  </div>
                </dl>
              </aside>

              <div className="hero-foot">
                {/* Stats row */}
                <div className="stats" role="list">
                  <div className="stat" role="listitem">
                    <b>10+</b>
                    <span>Years helping people find their glow</span>
                  </div>
                  <div className="stat" role="listitem">
                    <b className="num">$50</b>
                    <span>Accessible student tier</span>
                  </div>
                  <div className="stat" role="listitem">
                    <b className="num">24–48h</b>
                    <span>Rapid turnaround on revamps</span>
                  </div>
                  <div className="stat" role="listitem">
                    <b className="num">100%</b>
                    <span>ATS-friendly &amp; personalized</span>
                  </div>
                </div>

                {/* Hero Call to Action Buttons - 4 Prominent CTAs */}
                <div className="hero-cta">
                  <div className="hero-cta-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {/* CTA 1: Explore Our Services */}
                    <a href="#work" className="btn-ink">
                      <span>Explore Our Services</span>
                      <ArrowRight style={{ width: '14px', height: '14px' }} />
                    </a>

                    {/* CTA 2: Get a Free Career & Résumé Assessment */}
                    <button
                      type="button"
                      onClick={() => setIsAssessmentModalOpen(true)}
                      className="btn-ink"
                      style={{
                        background: 'linear-gradient(135deg, #C2185B 0%, #9C1450 100%)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        boxShadow: '0 4px 14px rgba(194, 24, 91, 0.35)'
                      }}
                    >
                      <Sparkles style={{ width: '15px', height: '15px', color: '#FCE8F0' }} />
                      <span>Free Career &amp; Résumé Assessment</span>
                    </button>

                    {/* CTA 3: View Our Work */}
                    <a href="#portfolio" className="btn-line">
                      <span>View Our Work</span>
                    </a>

                    {/* CTA 4: Book a Free Consultation */}
                    <a
                      href="https://calendly.com/purposeandglowcareers/career-consultation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-line"
                    >
                      <Calendar style={{ width: '15px', height: '15px' }} />
                      <span>Book Free Consultation</span>
                      <ExternalLink style={{ width: '12px', height: '12px', opacity: 0.8 }} />
                    </a>

                    {/* CTA 5: Free Job Search Registration */}
                    <a
                      href="https://tally.so/r/q5a1RY"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-line"
                      title="Free Job Search Assistance Registration via Tally"
                    >
                      <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                      <span>Free Job Search Registration</span>
                      <ExternalLink style={{ width: '12px', height: '12px', opacity: 0.8 }} />
                    </a>
                  </div>
                  <small>
                    Press <kbd>Shift</kbd> + <kbd>C</kbd> to jump straight to consultation inquiries
                  </small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: The Work / Featured Résumé Services */}
        <section className="block" id="work" data-sect data-label="Services" aria-labelledby="workTitle">
          <div className="wrap block-grid">
            {/* Real Founder Portrait and Mission Frame */}
            <figure className="fig">
              <div className="fig-frame">
                <img
                  src="/assets/branding/nicole.jpeg"
                  alt="Founder of Purpose & Glow Career Solutions"
                  width="600"
                  height="750"
                  loading="lazy"
                />
              </div>
              <figcaption>
                <b>The Purpose &amp; Glow Story</b>
                <span>“For over 10 years, I’ve been helping family and friends with their résumés. I feel like I found my purpose through helping others, and now I want to help others find their glow.”</span>
              </figcaption>
            </figure>

            {/* Featured Services Suite */}
            <div>
              <div className="sh">
                <p className="label red">
                  <span>Services</span>
                  <span>Personalized &amp; Collaborative</span>
                </p>
                <h2 id="workTitle">
                  Personalized <em>Résumé Services</em>
                </h2>
                <p>
                  Whether you’re updating your current résumé, starting from scratch, or preparing for your first job, Purpose &amp; Glow offers personalized résumé services to help you showcase your skills, experience, and accomplishments.
                </p>
              </div>

              {/* Interactive Accordion Dossiers */}
              <div className="svc" role="region" aria-label="Service catalog details">
                {/* 1. Résumé Revamp */}
                <details open>
                  <summary>
                    <span className="nm">Résumé Revamp</span>
                    <span className="pr num">$99</span>
                    <svg className="pm" viewBox="0 0 18 18" aria-hidden="true">
                      <line x1="2" y1="9" x2="16" y2="9" />
                      <line x1="9" y1="2" x2="9" y2="16" className="v" />
                    </svg>
                  </summary>
                  <div className="body">
                    <p>
                      For clients who already have a résumé and need professional revisions, stronger wording, improved organization, and better presentation of their experience.
                    </p>
                    <ul>
                      <li>Complete improvement of an existing résumé</li>
                      <li>Stronger professional summary and experience descriptions</li>
                      <li>Improved skills and accomplishments</li>
                      <li>Clean, ATS-friendly formatting</li>
                      <li>Editable Word document (.docx) and PDF</li>
                      <li>24–48 hour rapid turnaround</li>
                    </ul>
                    <div className="svc-actions">
                      <button
                        type="button"
                        onClick={() => handleSelectService('Professional Résumé Revamp — $99')}
                        className="btn-ink"
                      >
                        Select Revamp ($99) →
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEmailModal('Professional Résumé Revamp — $99')}
                        className="btn-line"
                      >
                        Ask a Question
                      </button>
                    </div>
                  </div>
                </details>

                {/* 2. Résumé Created From Scratch */}
                <details>
                  <summary>
                    <span className="nm">Résumé Created From Scratch</span>
                    <span className="pr num">$145</span>
                    <svg className="pm" viewBox="0 0 18 18" aria-hidden="true">
                      <line x1="2" y1="9" x2="16" y2="9" />
                      <line x1="9" y1="2" x2="9" y2="16" className="v" />
                    </svg>
                  </summary>
                  <div className="body">
                    <p>
                      For clients who need a complete résumé developed using their actual work history, education, accomplishments, skills, and career goals. Ideal for career changers, veterans, and professionals with 8–15+ years of diverse experience.
                    </p>
                    <ul>
                      <li>Complete résumé created from your experience and career goals</li>
                      <li>Professional summary, experience, skills, and education</li>
                      <li>ATS-friendly formatting tailored for recruiting software</li>
                      <li>Delivered in editable Word document and PDF</li>
                      <li>Collaborative drafting with 3–5 business days turnaround</li>
                    </ul>
                    <div className="svc-actions">
                      <button
                        type="button"
                        onClick={() => handleSelectService('Created From Scratch — $145')}
                        className="btn-ink"
                      >
                        Select From Scratch ($145) →
                      </button>
                    </div>
                  </div>
                </details>

                {/* 3. Student Résumé Services */}
                <details>
                  <summary>
                    <span className="nm">Student Résumé Services</span>
                    <span className="pr num">$50</span>
                    <svg className="pm" viewBox="0 0 18 18" aria-hidden="true">
                      <line x1="2" y1="9" x2="16" y2="9" />
                      <line x1="9" y1="2" x2="9" y2="16" className="v" />
                    </svg>
                  </summary>
                  <div className="body">
                    <p>
                      Affordable, high-impact résumé assistance for students and recent grads preparing for employment opportunities.
                    </p>
                    <ul>
                      <li>Highlight education, transferable skills, activities, and coursework</li>
                      <li>Suitable for first jobs, internships, and entry-level positions</li>
                      <li>Clean formatting formatted to impress hiring managers</li>
                      <li>Fast 24–48 hour turnaround</li>
                    </ul>
                    <div className="svc-actions">
                      <button
                        type="button"
                        onClick={() => handleSelectService('Student & Early Career Résumé — $50')}
                        className="btn-ink"
                      >
                        Select Student ($50) →
                      </button>
                    </div>
                  </div>
                </details>

                {/* 4. Free DIY Résumé Recommendations */}
                <details>
                  <summary>
                    <span className="nm">Free DIY Résumé Recommendations</span>
                    <span className="pr free num">$0</span>
                    <svg className="pm" viewBox="0 0 18 18" aria-hidden="true">
                      <line x1="2" y1="9" x2="16" y2="9" />
                      <line x1="9" y1="2" x2="9" y2="16" className="v" />
                    </svg>
                  </summary>
                  <div className="body">
                    <p>
                      I personally review résumés and offer recommendations for people who would rather make the changes themselves. There’s no obligation to purchase anything.
                    </p>
                    <ul>
                      <li>Actionable formatting and alignment suggestions</li>
                      <li>Honest feedback on bullet wording and clarity</li>
                      <li>Zero sales pressure or mandatory follow-ups</li>
                    </ul>
                    <div className="svc-actions">
                      <a
                        href="mailto:purposeandglowcareers@gmail.com?subject=Free%20DIY%20Résumé%20Recommendations%20Request"
                        className="btn-ink"
                      >
                        Request Free Recommendations →
                      </a>
                    </div>
                  </div>
                </details>
              </div>

              {/* Interactive 3-Step Service Recommendation Guide */}
              <div style={{ marginTop: '28px' }}>
                <FindYourServiceGuide
                  onSelectService={handleSelectService}
                  onOpenAssessment={() => setIsAssessmentModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section: Testimony / Client Reviews */}
        <section className="block" id="testimony" data-sect data-label="Reviews" aria-labelledby="testTitle">
          <div className="wrap block-grid flip">
            {/* Real LinkedIn Review Screenshot */}
            <figure className="fig">
              <div className="fig-frame fig-frame-review">
                <img
                  src={activeReview.image}
                  alt={`Verified review from ${activeReview.name}`}
                  className="review-screenshot-img"
                  width="600"
                  height="450"
                  loading="lazy"
                />
              </div>
              <figcaption>
                <b>Verified LinkedIn Recommendation</b>
                <span>{activeReview.name} · {activeReview.date}</span>
              </figcaption>
            </figure>

            {/* Testimonial Quote Carousel */}
            <div>
              <div className="sh">
                <p className="label red">
                  <span>Client Reviews</span>
                </p>
                <h2 id="testTitle">
                  What My Clients <em>Are Saying</em>
                </h2>
                <p>
                  Real recommendations from actual job seekers who trusted Purpose &amp; Glow to modernize their career documents.
                </p>
              </div>

              <div className="quote-wrap">
                <blockquote className="bigquote">
                  <svg className="qm" viewBox="0 0 44 36" aria-hidden="true">
                    <path d="M0 22 C0 9 9 0 20 0 L20 7 C13 7 8 12 8 19 L20 19 L20 36 L0 36 Z M24 22 C24 9 33 0 44 0 L44 7 C37 7 32 12 32 19 L44 19 L44 36 L24 36 Z" />
                  </svg>
                  <p>“{activeReview.quote}”</p>
                  <footer>
                    <cite>{activeReview.name}</cite>
                    <span className="role">— {activeReview.role} {activeReview.company ? `(${activeReview.company})` : ''}</span>
                  </footer>
                </blockquote>

                {/* Carousel Controls */}
                <div className="q-ctrl">
                  <button
                    type="button"
                    className="sq"
                    onClick={() => setReviewIdx((reviewIdx - 1 + REAL_CLIENT_REVIEWS.length) % REAL_CLIENT_REVIEWS.length)}
                    aria-label="Previous review"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="sq"
                    onClick={() => setReviewIdx((reviewIdx + 1) % REAL_CLIENT_REVIEWS.length)}
                    aria-label="Next review"
                  >
                    <ChevronRight />
                  </button>
                  <span className="q-count">
                    Review <b>{reviewIdx + 1}</b> of <b>{REAL_CLIENT_REVIEWS.length}</b>
                  </span>
                </div>

                {/* Excerpt list of all verified clients */}
                <ul className="q-list">
                  {REAL_CLIENT_REVIEWS.map((rev, idx) => (
                    <li key={rev.id} style={{ cursor: 'pointer', opacity: idx === reviewIdx ? 1 : 0.7 }} onClick={() => setReviewIdx(idx)}>
                      <div className="stars">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" /></svg>
                        ))}
                      </div>
                      <p>“{rev.quote.length > 95 ? rev.quote.slice(0, 95) + '…' : rev.quote}”</p>
                      <span>{rev.name} · {rev.service}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Process / How We Work */}
        <section className="block" id="process" data-sect data-label="Process" aria-labelledby="procTitle">
          <div className="wrap block-grid">
            {/* Real Specimen Proof */}
            <figure className="fig">
              <div className="fig-frame">
                <img
                  src="/assets/samples/executive-leadership.png"
                  alt="Anonymized executive leadership résumé proof"
                  width="600"
                  height="750"
                  loading="lazy"
                />
              </div>
              <figcaption>
                <b>Proof of Craft</b>
                <span>Clean typographic hierarchy, quantified contributions, and 100% ATS parser fidelity.</span>
              </figcaption>
            </figure>

            {/* Cadence Diagram & Steps */}
            <div>
              <div className="sh">
                <p className="label red">
                  <span>Our Process</span>
                  <span>Collaborative Cadence</span>
                </p>
                <h2 id="procTitle">
                  From First Call <em>to Final File</em>
                </h2>
                <p>
                  No cookie-cutter templates or robotic generators. A structured, personal process that helps you identify the value you bring to the table and puts it directly onto the page.
                </p>
              </div>

              {/* Vector Process Flow */}
              <div className="diagram" aria-hidden="true">
                <svg viewBox="0 0 560 76">
                  <line x1="40" y1="36" x2="520" y2="36" className="track" />
                  <line x1="40" y1="36" x2="380" y2="36" className="draw" />
                  <circle cx="40" cy="36" r="8" className="node on" />
                  <circle cx="180" cy="36" r="8" className="node on" />
                  <circle cx="340" cy="36" r="8" className="node on" />
                  <circle cx="500" cy="36" r="8" className="node" />
                  <text x="40" y="20" textAnchor="middle">DISCOVERY</text>
                  <text x="40" y="60" textAnchor="middle" className="d">Day 01</text>
                  <text x="180" y="20" textAnchor="middle">DRAFTING</text>
                  <text x="180" y="60" textAnchor="middle" className="d">Days 01–03</text>
                  <text x="340" y="20" textAnchor="middle">REVISION</text>
                  <text x="340" y="60" textAnchor="middle" className="d">Days 03–04</text>
                  <text x="500" y="20" textAnchor="middle">DELIVERY</text>
                  <text x="500" y="60" textAnchor="middle" className="d">Day 05</text>
                </svg>
              </div>

              {/* Ordered Drafting Steps */}
              <ol className="steps">
                <li>
                  <span className="n">01</span>
                  <div>
                    <h3>Discovery &amp; Consultation</h3>
                    <p>We review your target job listings, work history, and the specific opportunities you want to unlock.</p>
                    <span className="when">Free 15-Min Intro or Intake Note</span>
                  </div>
                </li>
                <li>
                  <span className="n">02</span>
                  <div>
                    <h3>Ground-Up Drafting</h3>
                    <p>Every bullet is reconstructed to highlight contributions over duties: revenue impacted, errors reduced, workflows streamlined.</p>
                    <span className="when">First Draft Within 24–48h</span>
                  </div>
                </li>
                <li>
                  <span className="n">03</span>
                  <div>
                    <h3>Collaborative Revisions</h3>
                    <p>You review the draft line by line. We adjust wording, alignment, and emphasis until it feels 100% authentically you.</p>
                    <span className="when">Feedback &amp; Iteration</span>
                  </div>
                </li>
                <li>
                  <span className="n">04</span>
                  <div>
                    <h3>Final Delivery</h3>
                    <p>You receive clean, ATS-compliant Word (.docx) and PDF versions ready to submit to recruiters immediately.</p>
                    <span className="when">Ready to Submit</span>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* Section: Real Résumé Portfolio */}
        <section className="block" id="portfolio" data-sect data-label="Portfolio" aria-labelledby="portTitle">
          <div className="wrap">
            <div className="sh">
              <p className="label red">
                <span>Résumé Examples</span>
                <span>Genuine Client Previews</span>
              </p>
              <h2 id="portTitle">
                Real Client <em>Résumé Examples</em>
              </h2>
              <p>
                Here’s a look at some of the résumés created for clients across different industries and experience levels. Each one is tailored to the person’s background and career goals.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="filters" role="group" aria-label="Portfolio filters">
              {OBSIDIAN_FILTERS.map(([key, label]) => {
                const count =
                  key === 'all'
                    ? OBSIDIAN_SAMPLES.length
                    : key === 'shortlist'
                    ? Object.keys(shortlist).length
                    : OBSIDIAN_SAMPLES.filter((s) => s.cat === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    className="f-btn"
                    aria-pressed={portfolioFilter === key}
                    onClick={() => setPortfolioFilter(key)}
                  >
                    <span>{label}</span>
                    <span className="c">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="pf-meta">
              <span>Showing <strong>{visibleSamples.length}</strong> of {OBSIDIAN_SAMPLES.length} genuine work samples</span>
              <span>All samples anonymized · Genuine layout and content</span>
            </div>

            {/* Structured Portfolio Rows */}
            <div className="pf-list" role="feed" aria-label="Résumé sample list">
              {visibleSamples.map((sample, idx) => {
                const isShortlisted = !!shortlist[sample.id];
                return (
                  <article key={sample.id} className="pf-row" role="article">
                    <div className="pf-no">{String(idx + 1).padStart(2, '0')}</div>
                    <div className="pf-main">
                      <span className="pf-cat">{sample.cl}</span>
                      <h3>{sample.t}</h3>
                      <p>{sample.d}</p>
                    </div>

                    <dl className="pf-metrics">
                      {sample.m.map(([v, k], mIdx) => (
                        <div key={mIdx}>
                          <dd>{v}</dd>
                          <dt>{k}</dt>
                        </div>
                      ))}
                    </dl>

                    <div className="pf-actions">
                      <button
                        type="button"
                        onClick={() => setSelectedSample(sample)}
                        className="btn-line"
                        title="Inspect full résumé specimen layout"
                      >
                        Inspect Spec
                      </button>
                      <a
                        href={sample.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-line"
                        title="Open full PDF sample from business site"
                      >
                        <span>PDF ↗</span>
                      </a>
                      <button
                        type="button"
                        className="star-btn"
                        aria-pressed={isShortlisted}
                        onClick={(e) => toggleShortlist(sample.id, e)}
                        title={isShortlisted ? 'Remove from shortlist' : 'Add to my shortlist'}
                      >
                        <Star />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Horizontal Plates Strip */}
            <div className="plates-head">
              <div>
                <p className="label red">Visual Preview Strip</p>
                <h3>Specimen Plates</h3>
              </div>
              <p>Swipe or scroll horizontally to browse full layout plates across executive, technical, and healthcare formats.</p>
            </div>

            <div className="plates" tabIndex={0} aria-label="Specimen plates strip">
              {OBSIDIAN_SAMPLES.map((sample) => (
                <figure key={sample.id} className="plate">
                  <button
                    type="button"
                    onClick={() => setSelectedSample(sample)}
                    className="plate-btn"
                  >
                    <div className="plate-sheet">
                      <img
                        src={sample.previewImage}
                        alt={sample.t}
                        style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '320/420', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    </div>
                    <figcaption>
                      <b>{sample.t}</b>
                      <i>{sample.cl}</i>
                    </figcaption>
                  </button>
                </figure>
              ))}
            </div>
            <p className="plates-hint">
              <span className="num">09</span> authentic résumé specimens · Click any plate to inspect typography and structure
            </p>
          </div>
        </section>

        {/* Section: Pricing & Packages Matrix */}
        <section className="block" id="pricing" data-sect data-label="Pricing" aria-labelledby="priceTitle">
          <div className="wrap">
            <div className="sh">
              <p className="label red">
                <span>Pricing</span>
                <span>Transparent Rates</span>
              </p>
              <h2 id="priceTitle">
                Transparent Rates. <em>Zero Hidden Fees.</em>
              </h2>
              <p>
                Upfront pricing with no surprise charges. Choose an individual résumé service or bundle with cover letter writing and interview coaching.
              </p>
            </div>

            {/* View Mode Switcher: Stacked Cards (Mobile Friendly) vs Comparison Matrix */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', background: isDarkMode ? '#1E2333' : '#FCE8F0', padding: '4px', borderRadius: '12px' }}>
                <button
                  type="button"
                  onClick={() => setPricingViewMode('cards')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: pricingViewMode === 'cards' ? (isDarkMode ? '#C2185B' : '#FFFFFF') : 'transparent',
                    color: pricingViewMode === 'cards' ? (isDarkMode ? '#FFFFFF' : '#C2185B') : 'inherit',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: pricingViewMode === 'cards' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Stacked Cards (Mobile Easy)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingViewMode('table')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: pricingViewMode === 'table' ? (isDarkMode ? '#C2185B' : '#FFFFFF') : 'transparent',
                    color: pricingViewMode === 'table' ? (isDarkMode ? '#FFFFFF' : '#C2185B') : 'inherit',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: pricingViewMode === 'table' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Comparison Matrix (Table)
                </button>
              </div>

              <span style={{ fontSize: '12px', opacity: 0.8, fontWeight: 500 }}>
                All packages include editable Word (.docx) &amp; high-res PDF
              </span>
            </div>

            {/* Mobile-Friendly Stacked Cards */}
            {pricingViewMode === 'cards' && (
              <MobilePricingCards
                onSelectService={handleSelectService}
                onOpenAssessment={() => setIsAssessmentModalOpen(true)}
                isDarkMode={isDarkMode}
              />
            )}

            {/* Side-by-Side Comparison Matrix */}
            <div style={{ display: pricingViewMode === 'table' ? 'block' : 'none' }}>
            <p className="table-scroll-hint" aria-hidden="true">
              <span>←</span> Swipe horizontally to compare all packages ($50 to $239) <span>→</span>
            </p>
            <div className="table-wrap">
              <table className="cmp">
                <caption className="sr-only">Comprehensive Service Rate Comparison Matrix</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '22%' }}>Deliverable</th>
                    <th scope="col" style={{ width: '15%' }}>
                      <span className="plan">Student Tier</span>
                      <span className="price">$50</span>
                      <span className="who">Entry-level &amp; grads</span>
                    </th>
                    <th scope="col" className="hot" style={{ width: '21%' }}>
                      <span className="flag">Most Popular</span>
                      <span className="plan">Résumé Revamp</span>
                      <span className="price">$99</span>
                      <span className="who">Existing résumé overhaul</span>
                    </th>
                    <th scope="col" style={{ width: '14%' }}>
                      <span className="plan">From Scratch</span>
                      <span className="price">$145</span>
                      <span className="who">8–15+ yr career pivot</span>
                    </th>
                    <th scope="col" style={{ width: '14%' }}>
                      <span className="plan">Career Ready</span>
                      <span className="price">$189</span>
                      <span className="who">Revamp + Letter + Prep</span>
                    </th>
                    <th scope="col" style={{ width: '14%' }}>
                      <span className="plan">Fresh Start</span>
                      <span className="price">$239</span>
                      <span className="who">Scratch + Letter + Prep</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Target Experience</th>
                    <td>Recent graduates</td>
                    <td className="hot">Existing professionals</td>
                    <td>10+ years / career changers</td>
                    <td>Active applicants</td>
                    <td>Complete career re-entry</td>
                  </tr>
                  <tr>
                    <th scope="row">Turnaround Window</th>
                    <td className="n">24–48h</td>
                    <td className="hot n">24–48h</td>
                    <td className="n">3–5 days</td>
                    <td className="n">3–5 days</td>
                    <td className="n">3–5 days</td>
                  </tr>
                  <tr>
                    <th scope="row">Ground-Up Restructure</th>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td className="hot"><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                  </tr>
                  <tr>
                    <th scope="row">ATS Keyword Optimization</th>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td className="hot"><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                  </tr>
                  <tr>
                    <th scope="row">Targeted Cover Letter</th>
                    <td className="no">—</td>
                    <td className="hot no">—</td>
                    <td className="no">—</td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                  </tr>
                  <tr>
                    <th scope="row">45-Min Interview Prep + Guide</th>
                    <td className="no">—</td>
                    <td className="hot no">—</td>
                    <td className="no">—</td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                  </tr>
                  <tr>
                    <th scope="row">Editable Word (.docx) &amp; PDF</th>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td className="hot"><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                    <td><Check style={{ width: '16px', height: '16px', margin: '0 auto', color: 'var(--red)' }} /></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleSelectService('Student & Early Career Résumé — $50')}
                        className="btn-line"
                      >
                        Select $50
                      </button>
                    </td>
                    <td className="hot">
                      <button
                        type="button"
                        onClick={() => handleSelectService('Professional Résumé Revamp — $99')}
                        className="btn-ink"
                      >
                        Select $99
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleSelectService('Created From Scratch — $145')}
                        className="btn-line"
                      >
                        Select $145
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleSelectService('Career Ready Package — $189')}
                        className="btn-line"
                      >
                        Select $189
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleSelectService('Fresh Start Package — $239')}
                        className="btn-line"
                      >
                        Select $239
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </div>

            {/* Individual Add-on Services Strip */}
            <div className="addons">
              <div className="addon">
                <b>
                  <span>Custom Cover Letter</span>
                  <span className="num">$49</span>
                </b>
                <p>Tailored specifically to one target role and company. Word + PDF delivered within 24–48h.</p>
                <button
                  type="button"
                  onClick={() => handleSelectService('Targeted Cover Letter — $49')}
                  className="ul"
                  style={{ marginTop: '8px', display: 'inline-block', fontSize: '13px', fontWeight: 600 }}
                >
                  Select Cover Letter →
                </button>
              </div>

              <div className="addon">
                <b>
                  <span>Résumé Tailoring</span>
                  <span className="num">$45</span>
                </b>
                <p>Fine-tuning an existing résumé for a specific job posting or keyword-heavy ATS requisition.</p>
                <button
                  type="button"
                  onClick={() => handleSelectService('Job-Specific Résumé Tailoring — $45')}
                  className="ul"
                  style={{ marginTop: '8px', display: 'inline-block', fontSize: '13px', fontWeight: 600 }}
                >
                  Select Tailoring →
                </button>
              </div>

              <div className="addon">
                <b>
                  <span>Interview Prep Session</span>
                  <span className="num">$65</span>
                </b>
                <p>45-minute 1-on-1 mock interview via Google Meet with custom follow-up preparation guide.</p>
                <button
                  type="button"
                  onClick={() => handleSelectService('Interview Preparation Session — $65')}
                  className="ul"
                  style={{ marginTop: '8px', display: 'inline-block', fontSize: '13px', fontWeight: 600 }}
                >
                  Select Interview Prep →
                </button>
              </div>

              <div className="addon free">
                <b>
                  <span>DIY Recommendations</span>
                  <span>$0 Free</span>
                </b>
                <p>Diagnostic review with constructive feedback for job seekers making changes themselves.</p>
                <button
                  type="button"
                  onClick={() => setIsAssessmentModalOpen(true)}
                  className="ul"
                  style={{ marginTop: '8px', display: 'inline-block', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                >
                  Request DIY Review →
                </button>
              </div>
            </div>

            {/* Accepted Payment Methods Banner */}
            <div style={{ marginTop: '32px' }}>
              <PaymentMethodsBanner isDarkMode={isDarkMode} />
            </div>
          </div>
        </section>

        {/* Section: Frequently Asked Questions */}
        <FaqAccordion isDarkMode={isDarkMode} />

        {/* Section: Career Resources & Job Search Strategy Guides */}
        <CareerResourcesSection isDarkMode={isDarkMode} />

        {/* Section: Contact & Inbound Ledger */}
        <section className="block" id="contact" data-sect data-label="Contact" aria-labelledby="contactTitle">
          <div className="wrap contact-grid">
            {/* Direct Contact Card */}
            <div className="card-nicole">
              <div className="mono">
                <img
                  src="/assets/branding/logo-180.png"
                  alt="Purpose & Glow Career Solutions"
                  style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                />
                <div>
                  <h3>Purpose &amp; Glow</h3>
                  <div className="role">Career Solutions · Professional Résumé Writing</div>
                </div>
              </div>

              <span className="avail">
                <i /> Taking New Clients · 24–48h Turnaround
              </span>

              {/* Verified Contact Details Rows */}
              <div className="c-rows">
                <div className="c-row">
                  <Mail />
                  <div>
                    <span className="k">Business Email</span>
                    <a href="mailto:purposeandglowcareers@gmail.com" className="v ul">
                      purposeandglowcareers@gmail.com
                    </a>
                  </div>
                  <button
                    type="button"
                    className={`copy ${copyFeedback === 'email' ? 'done' : ''}`}
                    onClick={() => handleCopy('purposeandglowcareers@gmail.com', 'email')}
                    title="Copy email address"
                  >
                    <Copy />
                    <span>{copyFeedback === 'email' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="c-row">
                  <Calendar />
                  <div>
                    <span className="k">Free 15-Min Intro</span>
                    <a
                      href="https://calendly.com/purposeandglowcareers/career-consultation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="v ul"
                    >
                      Book on Calendly ↗
                    </a>
                  </div>
                  <a
                    href="https://calendly.com/purposeandglowcareers/career-consultation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="copy"
                  >
                    <ExternalLink />
                    <span>Open</span>
                  </a>
                </div>

                <div className="c-row">
                  <Clock />
                  <div>
                    <span className="k">Location &amp; Hours</span>
                    <span className="v">Minnesota | Remote Services Nationwide · Mon–Fri 8am–6pm CT</span>
                  </div>
                </div>

                <div className="c-row">
                  <FileText />
                  <div>
                    <span className="k">Google Intake Form</span>
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSc3Yytk2ylUnjF3AUh3NnelWCoBAym-iH-n_k1LWQlNhBa62A/viewform"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="v ul"
                    >
                      Open Google Form ↗
                    </a>
                  </div>
                </div>

                <div className="c-row">
                  <CheckCircle2 />
                  <div>
                    <span className="k">Free Job Search Registration</span>
                    <a
                      href="https://tally.so/r/q5a1RY"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="v ul"
                    >
                      Open Free Tally Form ↗
                    </a>
                  </div>
                  <a
                    href="https://tally.so/r/q5a1RY"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="copy"
                    title="Open Tally Registration"
                  >
                    <ExternalLink />
                    <span>Open</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Inbound Consultation Form & Local Request Ledger */}
            <div>
              <form className="form" onSubmit={handleContactSubmit}>
                <p className="label red">Direct Consultation Request</p>
                <h3 id="contactTitle">Tell me about your target role.</h3>
                <p>
                  Fill out this brief inquiry and Purpose &amp; Glow will reply within one business day at purposeandglowcareers@gmail.com.
                </p>

                <div className="fields">
                  <div className="field">
                    <label htmlFor="fName">First Name</label>
                    <input
                      type="text"
                      id="fName"
                      required
                      placeholder="e.g. Courtney"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="fEmail">Email Address</label>
                    <input
                      type="email"
                      id="fEmail"
                      required
                      placeholder="e.g. courtney@example.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>

                  <div className="field full">
                    <label htmlFor="fService">Service Desired</label>
                    <select
                      id="fService"
                      value={formService}
                      onChange={(e) => setFormService(e.target.value)}
                    >
                      <option value="Professional Résumé Revamp — $99">Professional Résumé Revamp — $99</option>
                      <option value="Created From Scratch — $145">Created From Scratch — $145</option>
                      <option value="Student & Early Career Résumé — $50">Student &amp; Early Career Résumé — $50</option>
                      <option value="Targeted Cover Letter — $49">Targeted Cover Letter — $49</option>
                      <option value="Job-Specific Résumé Tailoring — $45">Job-Specific Résumé Tailoring — $45</option>
                      <option value="Interview Preparation Session — $65">Interview Preparation Session — $65</option>
                      <option value="Career Ready Package — $189">Career Ready Package — $189</option>
                      <option value="Fresh Start Package — $239">Fresh Start Package — $239</option>
                      <option value="Complimentary 15-Minute Strategy Call">Complimentary 15-Minute Strategy Call ($0)</option>
                      <option value="Free DIY Résumé Recommendations">Free DIY Résumé Recommendations ($0)</option>
                    </select>
                  </div>

                  <div className="field full">
                    <label htmlFor="fNote">Current Situation &amp; Goals</label>
                    <textarea
                      id="fNote"
                      placeholder="Briefly describe your background, current title, and target job titles..."
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-foot">
                  <div className={`form-status ${formStatus?.isErr ? 'err' : ''}`}>
                    {formStatus?.msg || 'Replies within one business day.'}
                  </div>
                  <button type="submit" className="btn-ink" disabled={isSubmitting}>
                    <span>{isSubmitting ? 'Sending Request...' : 'Send Consultation Request'}</span>
                    <ArrowRight style={{ width: '15px', height: '15px' }} />
                  </button>
                </div>
              </form>

              {/* Submissions Ledger */}
              <div className="ledger" aria-label="Recent consultation inquiries on this browser">
                <div className="ledger-head">
                  <h4>Your Inquiries on This Device</h4>
                  <span className="label">
                    {openRequestsCount} pending · {requestList.length} total
                  </span>
                </div>

                {requestList.length === 0 ? (
                  <span className="empty">No inquiries submitted yet from this browser.</span>
                ) : (
                  <ul>
                    {requestList.slice(0, 4).map((req) => (
                      <li key={req.id} className={req.done ? 'done' : ''}>
                        <span className="d">{new Date(req.at).toLocaleDateString()}</span>
                        <span className="who">
                          <b>{req.first}</b> · <span>{req.service}</span>
                        </span>
                        <div className="acts">
                          <button
                            type="button"
                            className="mini"
                            onClick={() => handleToggleRecordDone(req.id)}
                          >
                            {req.done ? 'Reopen' : 'Reviewed'}
                          </button>
                          <button
                            type="button"
                            className="mini"
                            onClick={() => handleDeleteRecord(req.id)}
                            title="Delete this record"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="brand">
                <img
                  src="/assets/branding/logo-1024.png"
                  alt="Purpose & Glow Career Solutions"
                  style={{ height: '34px', width: 'auto', marginBottom: '8px' }}
                />
              </div>
              <p style={{ fontStyle: 'italic', color: 'var(--red)', fontWeight: 600 }}>
                “Your Career. Your Purpose. Your Glow.”
              </p>
              <p>
                Personalized résumé writing, cover letters, tailoring, and interview preparation. Dedicated to helping job seekers authentically showcase their strengths.
              </p>
            </div>

            <div>
              <h4>Quick Links</h4>
              <ul>
                <li><a href="#work" className="ul">Featured Services</a></li>
                <li><a href="#testimony" className="ul">Client Reviews</a></li>
                <li><a href="#portfolio" className="ul">Résumé Portfolio</a></li>
                <li><a href="#pricing" className="ul">Services &amp; Pricing</a></li>
                <li><a href="#contact" className="ul">Contact &amp; Consultations</a></li>
              </ul>
            </div>

            <div>
              <h4>Direct Contact</h4>
              <ul>
                <li>
                  <a href="mailto:purposeandglowcareers@gmail.com" className="ul" style={{ color: 'var(--red)', fontWeight: 600 }}>
                    purposeandglowcareers@gmail.com
                  </a>
                </li>
                <li>Minnesota | Remote Services Nationwide</li>
                <li>Hours: Mon–Fri 8am–6pm CT</li>
                <li>
                  <a
                    href="https://calendly.com/purposeandglowcareers/career-consultation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ul"
                  >
                    Calendly Consultation ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/in/nicole-gotsch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ul"
                  >
                    Connect on LinkedIn ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="foot-base">
            <span>© {new Date().getFullYear()} Purpose &amp; Glow Career Solutions. All rights reserved.</span>
            <span>Your Career. Your Purpose. Your Glow.</span>
          </div>
        </div>
      </footer>

      {/* Floating Scroll-To-Top Button */}
      <button
        type="button"
        className={`to-top ${showToTop ? 'show' : ''}`}
        id="toTop"
        aria-label="Scroll to top of page"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp />
      </button>

      {/* Toast Feedback */}
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>

      {/* Lightbox Specimen Modal */}
      {selectedSample && (
        <div
          className="lb open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lbTitle"
          onClick={() => setSelectedSample(null)}
        >
          <div className="lb-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="sq lb-close"
              onClick={() => setSelectedSample(null)}
              aria-label="Close preview"
            >
              <X />
            </button>

            {/* Specimen sheet */}
            <div className="lb-sheet">
              <img
                src={selectedSample.previewImage}
                alt={selectedSample.t}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            {/* Body & Strategy breakdown */}
            <div className="lb-body">
              <span className="label red">Specimen Analysis · {selectedSample.cl}</span>
              <h2 id="lbTitle">{selectedSample.t}</h2>
              <p className="desc">{selectedSample.d}</p>

              <blockquote>
                “{selectedSample.q}”
                <span>— {selectedSample.who}</span>
              </blockquote>

              <dl className="lb-metrics">
                {selectedSample.m.map(([v, k], mIdx) => (
                  <div key={mIdx}>
                    <dd>{v}</dd>
                    <dt>{k}</dt>
                  </div>
                ))}
              </dl>

              <div className="lb-actions">
                <a
                  href={selectedSample.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ink"
                >
                  <FileText style={{ width: '15px', height: '15px' }} />
                  <span>Open Full PDF ↗</span>
                </a>
                <button
                  type="button"
                  className="star-btn"
                  aria-pressed={!!shortlist[selectedSample.id]}
                  onClick={(e) => toggleShortlist(selectedSample.id, e)}
                  title={shortlist[selectedSample.id] ? 'Remove from shortlist' : 'Add to shortlist'}
                >
                  <Star />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSample(null);
                    handleSelectService('Professional Résumé Revamp — $99');
                  }}
                  className="btn-line"
                >
                  Request This Format for My Résumé
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Inquiry Modal */}
      <EmailInquiryModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSubmitSuccess={handleEmailModalSuccess}
        defaultService={emailModalDefaultService}
        recipientEmail="purposeandglowcareers@gmail.com"
        isDarkMode={isDarkMode}
      />

      {/* Free Career & Résumé Assessment Modal */}
      <FreeAssessmentModal
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        onSubmitSuccess={handleAssessmentSuccess}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
