import http from 'http';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server.ts';
import { createRequireAdminAuth } from '../src/middleware/auth.ts';
import { getRateLimitCredentialSource } from '../src/lib/firebase-admin.ts';
import {
  BANNED_AI_PHRASES,
  auditAssessmentFactualAccuracy,
  buildAssessmentPromptPayload,
  enforceFactualGuardrailsBeforeDisplay,
  extractSeparatedSummary
} from '../src/lib/resumePromptGuard.ts';
import {
  PublicAssessmentRateLimiter,
  SerializedMemoryRateLimitStore,
  type RateLimitStore
} from '../src/lib/rateLimiter.ts';

function countWords(text: string): number {
  return text
    .replace(/^Ready-to-Adapt Summary:\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const FICTIONAL_ENTRY_LEVEL_RESUME = `HEALTHCARE ADMINISTRATION GRADUATE | [REDACTED_LOCATION]
Education: B.S. in Healthcare Administration, May 2026. Coursework in medical terminology, health policy, and Electronic Health Records fundamentals.
Experience:
- Summer Administrative Intern, Community Health Clinic (June 2025 – August 2025): Shadowed patient scheduling staff, organized intake packets, and assisted with scanning patient consent forms.
- Shift Barista, Campus Coffee Co. (2023 – Present): Prepared customer orders during peak morning hours, trained two new seasonal hires on register routines, and reconciled end-of-day cash drawer.
Skills: Microsoft Office, Patient Scheduling Support, Medical Terminology, Customer Service.`;

const FICTIONAL_CAREER_CHANGER_RESUME = `K-12 EDUCATOR & GRADE-LEVEL CURRICULUM COORDINATOR | [REDACTED_LOCATION]
Summary: High school educator with 8 years designing lesson plans, facilitating classroom training for diverse learners, and coordinating parent-teacher communication.
Experience:
- Classroom Teacher, Oakview Public Schools (2018 – Present): Delivered daily instruction for classes of 25–30 students, adapted written training guides for different learning paces, and maintained attendance and assessment logs.
- Grade-Level Coordinator (2021 – Present): Coordinated weekly curriculum pacing meetings with 5 fellow teachers and compiled shared onboarding checklists for substitute educators.
Skills: Workshop Facilitation, Written Training Guides, Cross-Team Coordination, Google Workspace, LMS Administration.`;

const FICTIONAL_EXECUTIVE_DIRECTOR_RESUME = `DIRECTOR OF OUTPATIENT CLINIC OPERATIONS | [REDACTED_LOCATION]
Summary: Healthcare operations director with 14 years overseeing multi-site ambulatory clinic workflows, staffing coordination, and payer compliance processes across regional specialty practices.
Experience:
- Director of Outpatient Operations, Midwest Specialty Clinics (2019 – Present): Directed daily non-clinical operations across 4 outpatient sites totaling 45 front-desk and billing staff, partnered with physician leads on clinic scheduling templates, and standardized patient intake documentation procedures.
- Clinic Operations Manager, Lakeshore Health Group (2014 – 2019): Managed 16 administrative specialists, led quarterly payer audit readiness reviews, and supported EHR template transitions.
Skills: Multi-Site Ambulatory Operations, Staff Supervision, Clinic Scheduling Workflows, Compliance Readiness, Epic Practice Management.`;

const MOCK_OUTPUTS_BY_ROLE: Record<string, any> = {
  'Patient Access Coordinator': {
    overallEvaluation:
      'You already have a focused mix of healthcare administration coursework, hands-on clinic internship exposure, and real-world customer service dependability. Right now, your résumé lists your clinic internship briefly and leaves transferable strengths from your barista role—like training two seasonal hires and handling busy morning rushes—under-explained for a Patient Access Coordinator hiring manager.',
    atsCompatibilityRecommendations: [
      'Because ATS capabilities and employer configurations vary, keep standard section labels ("Education", "Experience", "Skills") and clean single-column formatting so varied platforms and coordinators read your clinic internship and degree clearly.'
    ],
    professionalSummarySuggestions: [
      'Ready-to-Adapt Summary: "Recent B.S. in Healthcare Administration graduate bringing hands-on clinic internship exposure supporting patient scheduling, intake packet preparation, and consent form organization, alongside dependable fast-paced customer service experience. Familiar with medical terminology and EHR concepts, seeking an entry-level Patient Access Coordinator role supporting welcoming clinic check-in workflows."',
      'What this summary highlights: It keeps your experience completely honest—centering your internship, degree, and service reliability in roughly 53 words without claiming full-time hospital employment.'
    ],
    workExperienceRecommendations: [
      'Clarify what assisting with intake packets and scanning consent forms accomplished for clinic readiness without claiming EHR software expertise beyond coursework.',
      'Highlight that you trained two seasonal barista hires on register routines—that shows reliability and peer support without inflating part-time duties into management.'
    ],
    skillsAndKeywordRecommendations: [
      'Group documented strengths—Patient Scheduling Support, Intake Packet Organization, Medical Terminology, Customer Service, and Microsoft Office—under a concise Skills section.'
    ],
    formattingAndReadabilitySuggestions: ['Place Education and your Clinic Internship right below your Professional Summary so healthcare relevance appears in the top third of the page.'],
    practicalJobSearchRecommendations: [
      'Entry-level job titles aligned to your background: Patient Access Coordinator, Patient Registration Representative, Clinic Front-Desk Coordinator, and Medical Office Support Specialist.',
      'Useful search keywords: Patient Access, Patient Registration, Intake Coordination, Medical Terminology, Clinic Scheduling, and Outpatient Front Desk.',
      'Application strategy: Lead with your summer clinic internship plus customer service reliability in calm peak-hour environments.',
      'Interview preparation: Prepare one brief story about training seasonal teammates at Campus Coffee Co. and one about keeping clinic consent forms accurate during your internship.'
    ],
    beforeAfterExamples: [
      {
        originalContext: 'Shadowed patient scheduling staff, organized intake packets, and assisted with scanning patient consent forms.',
        improvedExample:
          'Assisted community health clinic front-desk staff by organizing daily patient intake packets, shadowing appointment scheduling workflows, and scanning signed consent forms accurately.',
        whyItWorks: 'Turns a condensed list into clearer clinic workflow support while keeping "Assisted" and "Shadowed" 100% factual.'
      },
      {
        originalContext: 'Prepared customer orders during peak morning hours, trained two new seasonal hires on register routines, and reconciled end-of-day cash drawer.',
        improvedExample:
          'Served high-volume morning customers accurately, trained two seasonal teammates on POS register procedures, and completed daily cash drawer reconciliation.',
        whyItWorks: 'Communicates accuracy and peer support clearly for Patient Access teams without exaggerating part-time barista scope into store management.'
      }
    ],
    suggestedServiceFocus:
      'This complimentary review is yours to use right away with zero obligation. If you want optional personal help tailoring your early-career résumé, explore Student & Early Career Services ($50) or Job-Specific Tailoring ($45)—or register free on Tally.'
  },
  'Healthcare Onboarding & Training Specialist': {
    overallEvaluation:
      'Transitioning from 8 years in K–12 teaching and grade-level coordination into Healthcare Onboarding & Training makes practical sense—you already write clear training materials and guide adult colleagues through onboarding checklists. Your main opportunity is translating classroom language into workplace training and staff onboarding terms without implying prior clinical or hospital EHR experience.',
    atsCompatibilityRecommendations: [
      'ATS capabilities and employer configurations vary widely, so stick to plain section headers ("Professional Summary", "Experience", "Skills") and avoid graphics or multi-column tables that can split apart when parsed.'
    ],
    professionalSummarySuggestions: [
      'Ready-to-Adapt Summary: "Educator and Grade-Level Coordinator with 8 years designing structured written training guides, facilitating daily group instruction, and compiling onboarding checklists for fellow staff. Brings clear communication, LMS administration, and cross-team coordination into a Healthcare Onboarding & Training Specialist role supporting staff learning workflows."',
      'What this summary highlights: Around 49 words connecting your documented LMS, training guide, and peer-onboarding work directly to your target pivot without claiming clinical background.'
    ],
    workExperienceRecommendations: [
      'Swap academic jargon ("classes of 25–30 students") for clear facilitation framing ("groups of 25–30 learners") while preserving exact classroom and peer-coordination responsibilities.',
      'Spotlight your Grade-Level Coordinator work compiling onboarding checklists for substitutes—it maps naturally to onboarding new clinic or corporate hires without claiming HR leadership.'
    ],
    skillsAndKeywordRecommendations: [
      'Emphasize verified transferable skills from your résumé: Workshop Facilitation, Written Training Guides, Onboarding Checklists, Cross-Team Coordination, LMS Administration, and Google Workspace.'
    ],
    formattingAndReadabilitySuggestions: ['Keep bullets focused on instructional clarity, adapting guides for varied paces, and organizing peer checklists rather than school-calendar details.'],
    practicalJobSearchRecommendations: [
      'Bridge-friendly job titles matched to your 8 years of experience: Onboarding & Training Specialist, Learning & Development Coordinator, Staff Education Specialist, and Instructional Facilitator.',
      'Useful search keywords: Staff Onboarding, Training Facilitation, Standard Operating Guides, LMS Administration, Curriculum Design, and Cross-Team Coordination.',
      'Application strategy: Highlight your substitute onboarding checklists and peer coordination directly alongside target postings—do not present K–12 classroom years as healthcare tenure.',
      'Interview preparation: Practice a clear 90-second bridge story explaining why you are moving into healthcare onboarding and how you adapt written guides for learners with different comfort levels.'
    ],
    beforeAfterExamples: [
      {
        originalContext: 'Delivered daily instruction for classes of 25–30 students, adapted written training guides for different learning paces, and maintained attendance and assessment logs.',
        improvedExample:
          'Facilitated daily structured instruction for groups of 25–30 learners, adapted written training guides for varied learning paces, and maintained accurate attendance and assessment records.',
        whyItWorks: 'Makes classroom experience immediately legible to healthcare L&D teams while preserving your exact documented numbers and duties.'
      },
      {
        originalContext: 'Coordinated weekly curriculum pacing meetings with 5 fellow teachers and compiled shared onboarding checklists for substitute educators.',
        improvedExample:
          'Coordinated weekly pacing sessions with 5 fellow educators and compiled practical onboarding checklists to help substitute staff step into workflows smoothly.',
        whyItWorks: 'Highlights adult peer coordination and onboarding documentation honestly without exaggerating your coordinator role into supervising staff.'
      }
    ],
    suggestedServiceFocus:
      'All feedback above is completely free to apply immediately. If you want optional 1-on-1 collaboration positioning a career pivot, consider Created From Scratch ($145), Résumé Revamp ($99), or Targeted Cover Letter ($49)—or request free Tally review.'
  },
  'Vice President of Ambulatory Operations': {
    overallEvaluation:
      'You bring 14 years of documented progression from Clinic Operations Manager to Director of Outpatient Operations across multi-site practices and 45 staff. As you step toward a Vice President of Ambulatory Operations seat, your priority is framing the enterprise scope behind coordinating across 4 clinic sites and physician stakeholders cleanly—without inventing unstated financial metrics or board mandates.',
    atsCompatibilityRecommendations: [
      'Executive and enterprise ATS configurations vary across health systems, so clean typography, standard executive section titles, and straightforward single-column structure keep multi-site scope readable for both systems and executive recruiters.'
    ],
    professionalSummarySuggestions: [
      'Ready-to-Adapt Summary: "Healthcare Operations Director with 14 years guiding multi-site ambulatory clinic operations, supervising 45 administrative and billing team members across 4 outpatient locations, and collaborating with physician leaders on clinic scheduling templates, patient intake standardization, payer audit readiness, and Epic Practice Management transitions—pursuing a Vice President of Ambulatory Operations role to support broader multi-clinic alignment."',
      'What this summary highlights: At roughly 61 words (appropriately expanded for executive scope), it anchors your documented 14-year trajectory, 4-site supervision, and Epic Practice Management background toward VP leadership without fabricating financial metrics.'
    ],
    workExperienceRecommendations: [
      'Keep your verified multi-site headcount (4 outpatient sites, 45 front-desk and billing staff, 16 specialists previously) upfront so executive scale is unmistakable without inventing budget dollars.',
      'Only add verifiable clinic or audit figures if you have documented records—do not add assumed revenue percentages or satisfaction scores.'
    ],
    skillsAndKeywordRecommendations: [
      'Keep executive operational strengths documented on your page front and center: Multi-Site Ambulatory Operations, Staff Supervision, Physician-Operations Alignment, Scheduling Standardization, Compliance Readiness, and Epic Practice Management.'
    ],
    formattingAndReadabilitySuggestions: ['Open each leadership role with a 1-line scope line (4 sites / 45 staff) followed by focused governance, workflow standardization, and stakeholder bullets.'],
    practicalJobSearchRecommendations: [
      'Executive-aligned alternative job titles: Vice President of Ambulatory Operations, Senior Director of Clinic Operations, Regional Director of Practice Operations, and Head of Outpatient Operations (avoid manager-level titles below your 14-year Director track).',
      'Useful search keywords: Multi-Site Ambulatory Operations, Outpatient Practice Leadership, Physician Alignment, Scheduling Governance, Epic Practice Management, and Compliance Readiness.',
      'Application strategy: Focus outreach on regional health systems and multi-site specialty groups where 4-site physician-operations collaboration translates naturally.',
      'Interview preparation: Prepare concise executive examples on leading EHR template transitions, coordinating scheduling workflows with physician partners, and preparing multi-site teams for quarterly payer audits.'
    ],
    beforeAfterExamples: [
      {
        originalContext: 'Directed daily non-clinical operations across 4 outpatient sites totaling 45 front-desk and billing staff, partnered with physician leads on clinic scheduling templates, and standardized patient intake documentation procedures.',
        improvedExample:
          'Directed multi-site non-clinical operations across 4 outpatient clinics (45 front-desk and billing staff), partnering with physician leaders to align clinic scheduling templates and standardize intake documentation workflows across locations.',
        whyItWorks: 'Clarifies multi-site executive governance while keeping only the 4 sites and 45 staff actually documented on your résumé.'
      },
      {
        originalContext: 'Managed 16 administrative specialists, led quarterly payer audit readiness reviews, and supported EHR template transitions.',
        improvedExample:
          'Managed 16 administrative specialists, led quarterly payer audit readiness reviews, and supported team execution during EHR template transitions.',
        whyItWorks: 'Keeps "Managed" and "led" accurately where you documented them, and leaves "supported" faithful on EHR template transitions without overstating technical ownership.'
      }
    ],
    suggestedServiceFocus:
      'Everything above is complete on its own with no obligation to purchase. If you ever want optional executive collaboration, Created From Scratch ($145) or Interview Preparation ($65) are available—alongside complimentary human review via Tally.'
  }
};

describe('Phase 4 Multi-Career-Level Evaluation & Production Security Audit', () => {
  let gatedServer: http.Server;
  let gatedBaseUrl = '';

  const tokenVerifier = async (token: string) => {
    if (token === 'valid-admin-token') {
      return {
        uid: 'uid-nicole',
        email: 'purposeandglowcareers@gmail.com',
        email_verified: true
      } as any;
    }
    throw new Error('Unauthorized');
  };

  const mockAiClient = {
    models: {
      generateContent: async (args: { contents: string }) => {
        const titleLine = /Target Job Title:\s*(.+)/.exec(args.contents)?.[1]?.trim() || '';
        const selected =
          MOCK_OUTPUTS_BY_ROLE[titleLine] || MOCK_OUTPUTS_BY_ROLE['Patient Access Coordinator'];
        return { text: JSON.stringify(selected) };
      }
    }
  } as any;

  beforeAll(async () => {
    const gated = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: mockAiClient,
      publicAiEnabledOverride: false,
      isProductionOverride: false
    });
    gatedServer = http.createServer(gated.app);
    await new Promise<void>((r) => gatedServer.listen(0, '127.0.0.1', r));
    gatedBaseUrl = `http://127.0.0.1:${(gatedServer.address() as any).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => gatedServer.close(() => r()));
  });

  it('produces grounded, personalized 8-section outputs across Entry-Level, Career-Changer, and Executive profiles within summary word guidelines', async () => {
    const scenarios = [
      {
        label: 'Entry-Level',
        targetJobTitle: 'Patient Access Coordinator',
        industry: 'Healthcare / Clinical / Revenue Cycle',
        resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
        minWords: 35,
        maxWords: 65,
        forbiddenTerms: ['managed store', 'supervised staff', 'Epic Resolute', 'CPA', 'CPHQ'],
        expectedTitleKeyword: 'Patient Access Coordinator'
      },
      {
        label: 'Career Changer',
        targetJobTitle: 'Healthcare Onboarding & Training Specialist',
        industry: 'Career Pivot / Multiple Industries',
        resumeText: FICTIONAL_CAREER_CHANGER_RESUME,
        minWords: 35,
        maxWords: 65,
        forbiddenTerms: ['hospital tenure', 'clinical license', 'supervised staff', '10+ years in healthcare'],
        expectedTitleKeyword: 'Onboarding & Training Specialist'
      },
      {
        label: 'Director / Executive',
        targetJobTitle: 'Vice President of Ambulatory Operations',
        industry: 'Operations & Practice Management',
        resumeText: FICTIONAL_EXECUTIVE_DIRECTOR_RESUME,
        minWords: 45,
        maxWords: 90,
        forbiddenTerms: ['$50M', 'Board of Directors', 'CEO', 'entry-level clerk'],
        expectedTitleKeyword: 'Senior Director of Clinic Operations'
      }
    ];

    for (const s of scenarios) {
      const res = await fetch(`${gatedBaseUrl}/api/admin/assessments/preview-test`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetJobTitle: s.targetJobTitle,
          industry: s.industry,
          resumeText: s.resumeText
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const a = data.assessment;
      const serialized = JSON.stringify(a);

      // All 8 required sections present
      expect(a.overallEvaluation.length).toBeGreaterThan(40);
      expect(a.atsCompatibilityRecommendations.length).toBeGreaterThanOrEqual(1);
      expect(a.professionalSummarySuggestions.length).toBeGreaterThanOrEqual(1);
      expect(a.workExperienceRecommendations.length).toBeGreaterThanOrEqual(1);
      expect(a.skillsAndKeywordRecommendations.length).toBeGreaterThanOrEqual(1);
      expect(a.formattingAndReadabilitySuggestions.length).toBeGreaterThanOrEqual(1);
      expect(a.practicalJobSearchRecommendations.length).toBeGreaterThanOrEqual(3);
      expect(a.disclaimer).toContain('does not guarantee');
      expect(a.factualWarnings, `${s.label} unexpected warnings`).toBeUndefined();
      expect(a.beforeAfterExamples.length).toBeGreaterThanOrEqual(2);

      // Check Ready-to-Adapt Summary word count guidelines
      const summaryWords = countWords(a.professionalSummarySuggestions[0]);
      expect(summaryWords, `${s.label} summary word count (${summaryWords})`).toBeGreaterThanOrEqual(
        s.minWords
      );
      expect(summaryWords, `${s.label} summary word count (${summaryWords})`).toBeLessThanOrEqual(
        s.maxWords
      );

      // Check career-appropriate alternative titles & zero fabrication
      expect(a.practicalJobSearchRecommendations.join(' ')).toContain(s.expectedTitleKeyword);
      for (const banned of BANNED_AI_PHRASES) {
        expect(serialized.toLowerCase()).not.toContain(banned.toLowerCase());
      }
      for (const forbidden of s.forbiddenTerms) {
        expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }

    // Verify prompt instructions themselves explicitly include the 40-60 word executive-flexible guideline
    const promptCheck = buildAssessmentPromptPayload({
      targetJobTitle: 'Vice President of Ambulatory Operations',
      resumeText: FICTIONAL_EXECUTIVE_DIRECTOR_RESUME
    });
    expect(promptCheck.promptText).toContain('40–60 words');
    expect(promptCheck.promptText).toContain('flexible for executive candidates');
  });

  it('withholds or repairs invented metrics, Directed->Directing tense shifts, responsibility upgrades, undocumented skills, robotic AI phrases, bold-bullet advice, and misaligned job titles without exposing internal placeholders publicly', async () => {
    const flawedOutputsByTitle: Record<string, any> = {
      'Patient Access Coordinator': {
        ...MOCK_OUTPUTS_BY_ROLE['Patient Access Coordinator'],
        overallEvaluation:
          'It is a pleasure to review your background. It is clear that your customer service resonates with clinics.',
        workExperienceRecommendations: [
          'Highlight that you boosted clinic check-in efficiency by 42%.',
          'Keep your clinic internship and customer service accuracy focused on verified tasks.'
        ],
        skillsAndKeywordRecommendations: [
          'Include documented HIPAA training and Epic certification in your Skills section.',
          'List documented strengths—Patient Scheduling Support, Medical Terminology, Customer Service—and separately note Skills to Develop: HIPAA training.'
        ],
        formattingAndReadabilitySuggestions: [
          'Bold entire bullet points so recruiters notice every accomplishment.'
        ],
        practicalJobSearchRecommendations: [
          'Consider senior roles such as Director of Patient Access or Chief Patient Officer.',
          'Entry-level job titles aligned to your background: Patient Access Coordinator, Patient Registration Representative.'
        ],
        beforeAfterExamples: [
          {
            originalContext:
              'Shadowed patient scheduling staff, organized intake packets, and assisted with scanning patient consent forms.',
            improvedExample:
              'Supervised patient scheduling staff and reduced intake errors by 30%.',
            whyItWorks: 'Upgrades internship scope.'
          },
          MOCK_OUTPUTS_BY_ROLE['Patient Access Coordinator'].beforeAfterExamples[1]
        ]
      },
      'Healthcare Onboarding & Training Specialist': {
        ...MOCK_OUTPUTS_BY_ROLE['Healthcare Onboarding & Training Specialist'],
        overallEvaluation:
          'With 8 years mentoring hospital staff, your payer compliance experience prepares you for Healthcare Onboarding & Training Specialist.',
        beforeAfterExamples: [
          {
            originalContext:
              'Coordinated weekly curriculum pacing meetings with 5 fellow teachers and compiled shared onboarding checklists for substitute educators.',
            improvedExample:
              'Led weekly curriculum teams and mentored 5 fellow teachers for audit readiness.',
            whyItWorks: 'Upgrades coordinator scope.'
          }
        ]
      },
      'Vice President of Ambulatory Operations': {
        ...MOCK_OUTPUTS_BY_ROLE['Vice President of Ambulatory Operations'],
        overallEvaluation:
          'It is clear you bring a proven track record across 14 years of progression from Clinic Operations Manager to Director of Outpatient Operations across 4 sites.',
        workExperienceRecommendations: [
          'Emphasize managing a $3.5M ambulatory budget and cutting wait times by 35%.',
          'Keep your verified multi-site headcount (4 outpatient sites, 45 front-desk and billing staff) upfront.'
        ],
        practicalJobSearchRecommendations: [
          'Backup titles: Clinic Operations Manager, Entry-Level Front-Desk Representative, or Billing Clerk.',
          'Executive-aligned alternative job titles: Vice President of Ambulatory Operations, Executive Director of Outpatient Services, Senior Director of Clinic Operations.'
        ],
        beforeAfterExamples: [
          {
            originalContext:
              'Directed daily non-clinical operations across 4 outpatient sites totaling 45 front-desk and billing staff.',
            improvedExample:
              'Directing multi-site non-clinical operations across 4 outpatient clinics totaling 45 front-desk and billing staff.',
            whyItWorks: 'Clarifies multi-site executive governance.'
          }
        ]
      }
    };

    const flawedAiClient = {
      models: {
        generateContent: async (args: { contents: string }) => {
          const titleLine = /Target Job Title:\s*(.+)/.exec(args.contents)?.[1]?.trim() || '';
          return {
            text: JSON.stringify(
              flawedOutputsByTitle[titleLine] || flawedOutputsByTitle['Patient Access Coordinator']
            )
          };
        }
      }
    } as any;

    const flawedSrvApp = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      publicAiEnabledOverride: false,
      isProductionOverride: false,
      aiClientOverride: flawedAiClient
    });

    const publicEnabledFlawedApp = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      publicAiEnabledOverride: true,
      isProductionOverride: false,
      aiClientOverride: flawedAiClient
    });

    const srv = http.createServer(flawedSrvApp.app);
    const pubSrv = http.createServer(publicEnabledFlawedApp.app);
    await Promise.all([
      new Promise<void>((r) => srv.listen(0, '127.0.0.1', r)),
      new Promise<void>((r) => pubSrv.listen(0, '127.0.0.1', r))
    ]);
    const url = `http://127.0.0.1:${(srv.address() as any).port}`;
    const pubUrl = `http://127.0.0.1:${(pubSrv.address() as any).port}`;

    try {
      // 1. Entry-Level: Admin preview retains factualWarnings; robotic phrases, bold-bullets, 42%, undocumented HIPAA training, Director title, & Supervised rewrite removed cleanly with ZERO internal placeholders
      const entryRes = await fetch(`${url}/api/admin/assessments/preview-test`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetJobTitle: 'Patient Access Coordinator',
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME
        })
      });
      expect(entryRes.status).toBe(200);
      const entryData = (await entryRes.json()).assessment;
      const entryJsonStr = JSON.stringify(entryData);
      expect(entryData.factualWarnings?.length).toBeGreaterThanOrEqual(4);
      expect(entryJsonStr).not.toContain('[Withheld for factual accuracy');
      expect(entryJsonStr).not.toContain('[verified % if documented]');
      expect(entryJsonStr).not.toContain('[withheld unverified claim]');
      expect(entryData.overallEvaluation).not.toContain('It is a pleasure to review your background');
      expect(entryData.overallEvaluation).not.toContain('It is clear that');
      expect(entryData.overallEvaluation).not.toContain('resonates with');
      expect(JSON.stringify(entryData.formattingAndReadabilitySuggestions)).toContain('Bold job titles');
      expect(JSON.stringify(entryData.formattingAndReadabilitySuggestions).toLowerCase()).not.toContain('bold entire bullet');
      expect(JSON.stringify(entryData.skillsAndKeywordRecommendations)).not.toContain('Include documented HIPAA training');
      expect(JSON.stringify(entryData.skillsAndKeywordRecommendations)).toContain('Skills to Develop: HIPAA training');
      expect(JSON.stringify(entryData.workExperienceRecommendations)).not.toContain('42%');
      expect(JSON.stringify(entryData.practicalJobSearchRecommendations)).not.toContain('Director of Patient Access');
      expect(JSON.stringify(entryData.beforeAfterExamples)).not.toContain('Supervised patient scheduling');
      expect(JSON.stringify(entryData.beforeAfterExamples)).toContain('Served high-volume morning customers');

      // 1b. Public endpoint returns clean output + friendly reminder, NEVER raw factualWarnings
      const publicEntryRes = await fetch(`${pubUrl}/api/public/resume-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobTitle: 'Patient Access Coordinator',
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
          consentGiven: true
        })
      });
      expect(publicEntryRes.status).toBe(200);
      const publicEntryData = (await publicEntryRes.json()).assessment;
      expect(publicEntryData.factualWarnings).toBeUndefined();
      expect(publicEntryData.publicVerificationReminder).toContain(
        'double-check that every suggested title, tool, and duty matches your actual experience'
      );
      expect(JSON.stringify(publicEntryData)).not.toContain('[Withheld for factual accuracy');

      // 2. Career Changer: mentoring / payer compliance / Led rewrite replaced naturally without internal placeholders, originalContext preserved
      const changerRes = await fetch(`${url}/api/admin/assessments/preview-test`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetJobTitle: 'Healthcare Onboarding & Training Specialist',
          resumeText: FICTIONAL_CAREER_CHANGER_RESUME
        })
      });
      expect(changerRes.status).toBe(200);
      const changerData = (await changerRes.json()).assessment;
      expect(changerData.factualWarnings?.length).toBeGreaterThanOrEqual(3);
      expect(changerData.overallEvaluation).not.toContain('mentoring hospital staff');
      expect(JSON.stringify(changerData)).not.toContain('[Withheld for factual accuracy');
      expect(JSON.stringify(changerData)).not.toContain('[withheld unverified claim]');
      expect(changerData.beforeAfterExamples[0].originalContext).toContain(
        'Coordinated weekly curriculum pacing meetings with 5 fellow teachers'
      );
      expect(changerData.beforeAfterExamples[0].improvedExample).toContain(
        'Coordinated weekly curriculum pacing meetings with 5 fellow teachers'
      );

      // 3. Executive: Directed->Directing restored to Directed, proven track record & It is clear softened, $3.5M/35%/Manager/Billing Clerk withheld while preserving 4 outpatient sites & Executive Director
      const execRes = await fetch(`${url}/api/admin/assessments/preview-test`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetJobTitle: 'Vice President of Ambulatory Operations',
          resumeText: FICTIONAL_EXECUTIVE_DIRECTOR_RESUME
        })
      });
      expect(execRes.status).toBe(200);
      const execData = (await execRes.json()).assessment;
      expect(execData.factualWarnings?.length).toBeGreaterThanOrEqual(3);
      expect(execData.overallEvaluation).not.toContain('It is clear');
      expect(execData.overallEvaluation).not.toContain('proven track record');
      expect(execData.overallEvaluation).toContain('progression from Clinic Operations Manager to Director');
      expect(JSON.stringify(execData.workExperienceRecommendations)).not.toContain('$3.5M');
      expect(JSON.stringify(execData.workExperienceRecommendations)).not.toContain('35%');
      expect(JSON.stringify(execData.workExperienceRecommendations)).toContain('4 outpatient sites');
      expect(JSON.stringify(execData.practicalJobSearchRecommendations)).not.toContain('Billing Clerk');
      expect(JSON.stringify(execData.practicalJobSearchRecommendations)).not.toContain('Backup titles: Clinic Operations Manager');
      expect(JSON.stringify(execData.practicalJobSearchRecommendations)).toContain('Executive Director of Outpatient Services');
      expect(execData.beforeAfterExamples[0].improvedExample).toMatch(/^Directed\b/);
      expect(execData.beforeAfterExamples[0].improvedExample).not.toMatch(/^Directing\b/);

      // 4. Career Changer who only *used* Canvas LMS (not LMS administration) cannot have "LMS Administration" recommended as an existing qualification
      const lmsUserResume = `K-12 EDUCATOR | [REDACTED_LOCATION]
Summary: High school teacher with 6 years creating lesson guides and using Canvas LMS to post weekly classroom assignments.
Skills: Workshop Facilitation, Written Training Guides, Canvas LMS User, Google Workspace.`;
      const lmsRes = await fetch(`${url}/api/admin/assessments/preview-test`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetJobTitle: 'Healthcare Onboarding & Training Specialist',
          resumeText: lmsUserResume
        })
      });
      expect(lmsRes.status).toBe(200);
      const lmsData = (await lmsRes.json()).assessment;
      expect(JSON.stringify(lmsData.skillsAndKeywordRecommendations)).not.toContain('LMS Administration');
    } finally {
      await Promise.all([
        new Promise<void>((r) => srv.close(() => r())),
        new Promise<void>((r) => pubSrv.close(() => r()))
      ]);
    }
  });

  it('preserves verified executive leadership verbs, checks rewritten bullets against the full source résumé, separates copy-ready summaries from coaching notes, and strips remaining robotic phrases', () => {
    // 1. Preserves Led / Directed / Managed on legitimate Executive Director résumé (never weakens or false-flags)
    const cleanExec = enforceFactualGuardrailsBeforeDisplay({
      resumeText: FICTIONAL_EXECUTIVE_DIRECTOR_RESUME,
      targetJobTitle: 'Vice President of Ambulatory Operations',
      includeAdminWarnings: true,
      assessment: {
        ...MOCK_OUTPUTS_BY_ROLE['Vice President of Ambulatory Operations'],
        beforeAfterExamples: [
          {
            originalContext:
              'Directed daily non-clinical operations across 4 outpatient sites totaling 45 front-desk and billing staff.',
            improvedExample:
              'Directed multi-site non-clinical operations across 4 outpatient sites totaling 45 front-desk and billing staff, coordinating scheduling workflows with physician leads using Epic Practice Management.',
            whyItWorks: 'Preserves Directed and uses verified Epic Practice Management documented elsewhere in the résumé.'
          },
          {
            originalContext:
              'Managed 16 administrative specialists, led quarterly payer audit readiness reviews, and supported EHR template transitions.',
            improvedExample:
              'Managed 16 administrative specialists and led quarterly payer audit readiness reviews across regional clinics.',
            whyItWorks: 'Preserves Managed and led accurately without overstating EHR template support.'
          }
        ],
        disclaimer: 'AI-generated guidance does not guarantee employment.'
      }
    });
    expect(cleanExec.factualWarnings).toBeUndefined();
    expect(cleanExec.beforeAfterExamples[0].improvedExample).toContain('Directed multi-site non-clinical operations');
    expect(cleanExec.beforeAfterExamples[0].improvedExample).toContain('Epic Practice Management');
    expect(cleanExec.beforeAfterExamples[1].improvedExample).toContain('Managed 16 administrative specialists and led quarterly');

    // 2. Rejects undocumented workflows/scale in rewritten bullets (e.g. "insurance claims", "12 clinics", "Epic EHR" for Entry-Level)
    const entryWithUndocumentedBullet = enforceFactualGuardrailsBeforeDisplay({
      resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
      targetJobTitle: 'Patient Access Coordinator',
      includeAdminWarnings: false,
      assessment: {
        ...MOCK_OUTPUTS_BY_ROLE['Patient Access Coordinator'],
        overallEvaluation:
          'Your background stands out as a testament to consistency, helping you hit the ground running and seamlessly connect with clinics.',
        beforeAfterExamples: [
          {
            originalContext:
              'Shadowed patient scheduling staff, organized intake packets, and assisted with scanning patient consent forms.',
            improvedExample:
              'Shadowed patient scheduling staff while processing insurance claims across 12 clinics in Epic EHR.',
            whyItWorks: 'Adds clinic billing context.'
          },
          MOCK_OUTPUTS_BY_ROLE['Patient Access Coordinator'].beforeAfterExamples[1]
        ],
        disclaimer: 'AI-generated guidance does not guarantee employment.'
      }
    });
    // Public output has zero raw factualWarnings, zero internal placeholders, zero robotic phrases, and omitted the fabricated bullet
    expect(entryWithUndocumentedBullet.factualWarnings).toBeUndefined();
    expect(entryWithUndocumentedBullet.overallEvaluation).not.toContain('testament to');
    expect(entryWithUndocumentedBullet.overallEvaluation).not.toContain('hit the ground running');
    expect(entryWithUndocumentedBullet.overallEvaluation).not.toContain('seamlessly');
    expect(JSON.stringify(entryWithUndocumentedBullet.beforeAfterExamples)).not.toContain('insurance claims');
    expect(JSON.stringify(entryWithUndocumentedBullet.beforeAfterExamples)).not.toContain('12 clinics');
    expect(JSON.stringify(entryWithUndocumentedBullet)).not.toContain('[Withheld');
    expect(entryWithUndocumentedBullet.beforeAfterExamples).toHaveLength(1);

    // Also verify auditAssessmentFactualAccuracy directly catches undocumented workflows & scale against full résumé
    const directAudit = auditAssessmentFactualAccuracy({
      resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
      targetJobTitle: 'Patient Access Coordinator',
      assessment: {
        ...MOCK_OUTPUTS_BY_ROLE['Patient Access Coordinator'],
        beforeAfterExamples: [
          {
            originalContext: 'Shadowed patient scheduling staff, organized intake packets, and assisted with scanning patient consent forms.',
            improvedExample: 'Shadowed patient scheduling staff, verified prior authorizations, and coordinated 50 patients daily.',
            whyItWorks: 'Clarifies daily flow.'
          }
        ],
        disclaimer: 'AI-generated guidance does not guarantee employment.'
      }
    });
    expect(directAudit.flagged).toBe(true);
    expect(directAudit.warnings.join(' ')).toContain('prior authorizations');
    expect(directAudit.warnings.join(' ')).toContain('50 patients');

    // 3. Separates Ready-to-Adapt Professional Summary from coaching explanations even if model bundles them together
    const separated = extractSeparatedSummary([
      'Ready-to-Adapt Summary: "Educator with 8 years facilitating group instruction and writing clear training guides, transitioning into Healthcare Onboarding & Training." (21 words) Why this works: Connects your facilitation directly to healthcare onboarding.',
      'Keep clinical claims out until trained.'
    ]);
    expect(separated.readyToAdaptSummary).toBe(
      'Educator with 8 years facilitating group instruction and writing clear training guides, transitioning into Healthcare Onboarding & Training.'
    );
    expect(separated.summaryCoachingNote).toContain('Why this works: Connects your facilitation directly');
    expect(separated.summaryCoachingNote).toContain('Keep clinical claims out until trained.');
    expect(cleanExec.readyToAdaptSummary).toBeTruthy();
    expect(cleanExec.readyToAdaptSummary).not.toMatch(/^Ready-to-Adapt Summary:/i);
    expect(cleanExec.readyToAdaptSummary).not.toContain('What this summary highlights:');
    expect(cleanExec.summaryCoachingNote).toContain('What this summary highlights:');

    // 4. Client modal supports dedicated Copy Summary Only and never exposes raw factualWarnings
    const modalSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/PublicResumeAssessmentModal.tsx'),
      'utf8'
    );
    expect(modalSource).toContain('Copy Summary Only');
    expect(modalSource).not.toContain('factualWarnings');
  });

  it('prevents X-Forwarded-For spoofing, enforces Turnstile & distributed rate limits in production (fail-closed 503), and validates keyless ADC detection', async () => {
    // 1. Keyless Managed ADC detection without long-lived JSON key
    expect(
      getRateLimitCredentialSource({
        NODE_ENV: 'production',
        K_SERVICE: 'purpose-glow-web'
      } as NodeJS.ProcessEnv)
    ).toBe('managed_service_account_adc');
    expect(
      getRateLimitCredentialSource({
        RATE_LIMIT_BACKEND: 'firestore'
      } as NodeJS.ProcessEnv)
    ).toBe('managed_service_account_adc');
    expect(getRateLimitCredentialSource({} as NodeJS.ProcessEnv)).toBe('local_dev_none');

    // 2. Production server with local memory store ONLY -> MUST fail closed (503) instead of calling Gemini
    const prodNoDist = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: mockAiClient,
      publicAiEnabledOverride: true,
      isProductionOverride: true,
      rateLimitStoreOverride: new SerializedMemoryRateLimitStore(),
      turnstileVerifierOverride: async () => ({ configured: true, verified: true })
    });
    const noDistSrv = http.createServer(prodNoDist.app);
    await new Promise<void>((r) => noDistSrv.listen(0, '127.0.0.1', r));
    const noDistUrl = `http://127.0.0.1:${(noDistSrv.address() as any).port}`;

    try {
      const blockedNoDist = await fetch(`${noDistUrl}/api/public/resume-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobTitle: 'Patient Access Coordinator',
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
          consentGiven: true
        })
      });
      expect(blockedNoDist.status).toBe(503);
      expect((await blockedNoDist.json()).errorCode).toBe('DISTRIBUTED_LIMITER_REQUIRED');
    } finally {
      await new Promise<void>((r) => noDistSrv.close(() => r()));
    }

    // 3. Production server WITHOUT Turnstile configured -> MUST fail closed (503 TURNSTILE_REQUIRED)
    const fakeDistributedStore: RateLimitStore = {
      mode: 'distributed_custom',
      consumeQuota: (params) => new SerializedMemoryRateLimitStore().consumeQuota(params)
    };
    const prodNoTurnstile = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: mockAiClient,
      publicAiEnabledOverride: true,
      isProductionOverride: true,
      rateLimitStoreOverride: fakeDistributedStore
    });
    const noTurnSrv = http.createServer(prodNoTurnstile.app);
    await new Promise<void>((r) => noTurnSrv.listen(0, '127.0.0.1', r));
    const noTurnUrl = `http://127.0.0.1:${(noTurnSrv.address() as any).port}`;

    try {
      const blockedNoTurnstile = await fetch(`${noTurnUrl}/api/public/resume-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobTitle: 'Patient Access Coordinator',
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
          consentGiven: true
        })
      });
      expect(blockedNoTurnstile.status).toBe(503);
      expect((await blockedNoTurnstile.json()).errorCode).toBe('TURNSTILE_REQUIRED');
    } finally {
      await new Promise<void>((r) => noTurnSrv.close(() => r()));
    }

    // 4. Anti-IP Spoofing + Firestore failure fail-closed check in production mode
    const sharedMemStore = new SerializedMemoryRateLimitStore();
    const sharedDistStore: RateLimitStore = {
      mode: 'distributed_custom',
      consumeQuota: (p) => sharedMemStore.consumeQuota(p)
    };
    const prodHardened = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: mockAiClient,
      publicAiEnabledOverride: true,
      isProductionOverride: true,
      rateLimitStoreOverride: sharedDistStore,
      turnstileVerifierOverride: async () => ({ configured: true, verified: true })
    });
    const hardenedSrv = http.createServer(prodHardened.app);
    await new Promise<void>((r) => hardenedSrv.listen(0, '127.0.0.1', r));
    const hardenedUrl = `http://127.0.0.1:${(hardenedSrv.address() as any).port}`;

    try {
      // Attacker rotates leftmost spoofed X-Forwarded-For IP on every call; rightmost trusted socket/proxy IP stays constant!
      const spoofAttempts = await Promise.all([1, 2, 3, 4].map((n) =>
        fetch(`${hardenedUrl}/api/public/resume-assessment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `198.51.100.${n}, 203.0.113.50`
          },
          body: JSON.stringify({
            targetJobTitle: 'Patient Access Coordinator',
            resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
            consentGiven: true
          })
        })
      ));
      const codes = spoofAttempts.map((r) => r.status);
      expect(codes.filter((c) => c === 200)).toHaveLength(3);
      expect(codes.filter((c) => c === 429)).toHaveLength(1);

      // Oversized targetJobTitle & jobDescription rejected cleanly (400)
      const hugeTitle = await fetch(`${hardenedUrl}/api/public/resume-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobTitle: 'A'.repeat(200),
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
          consentGiven: true
        })
      });
      expect(hugeTitle.status).toBe(400);

      const hugeJobDesc = await fetch(`${hardenedUrl}/api/public/resume-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobTitle: 'Patient Access Coordinator',
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
          jobDescription: 'B'.repeat(4500),
          consentGiven: true
        })
      });
      expect(hugeJobDesc.status).toBe(400);

      // Admin metrics exposes credentialSource without leaking secrets
      const metricsRes = await fetch(`${hardenedUrl}/api/admin/assessments/metrics`, {
        headers: { Authorization: 'Bearer valid-admin-token' }
      });
      expect(metricsRes.status).toBe(200);
      const metricsText = await metricsRes.text();
      expect(metricsText).toContain('credentialSource');
      expect(metricsText).not.toContain('PRIVATE_KEY');
      expect(metricsText).not.toContain('TURNSTILE_SECRET');
    } finally {
      await new Promise<void>((r) => hardenedSrv.close(() => r()));
    }

    // 5. Throwing Firestore transaction fails closed (503 DISTRIBUTED_LIMITER_UNAVAILABLE)
    const failingStore: RateLimitStore = {
      mode: 'distributed_firestore',
      consumeQuota: async () => {
        throw new Error('PERMISSION_DENIED: Firestore cross-project ADC missing IAM role');
      }
    };
    const prodFailingLimiter = createApp({
      adminMiddleware: createRequireAdminAuth(tokenVerifier),
      aiClientOverride: mockAiClient,
      publicAiEnabledOverride: true,
      isProductionOverride: true,
      rateLimitStoreOverride: failingStore,
      turnstileVerifierOverride: async () => ({ configured: true, verified: true })
    });
    const failSrv = http.createServer(prodFailingLimiter.app);
    await new Promise<void>((r) => failSrv.listen(0, '127.0.0.1', r));
    const failUrl = `http://127.0.0.1:${(failSrv.address() as any).port}`;

    try {
      const res = await fetch(`${failUrl}/api/public/resume-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobTitle: 'Patient Access Coordinator',
          resumeText: FICTIONAL_ENTRY_LEVEL_RESUME,
          consentGiven: true
        })
      });
      expect(res.status).toBe(503);
      expect((await res.json()).errorCode).toBe('DISTRIBUTED_LIMITER_UNAVAILABLE');
    } finally {
      await new Promise<void>((r) => failSrv.close(() => r()));
    }
  });
});
