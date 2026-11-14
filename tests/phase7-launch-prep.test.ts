import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BUSINESS_CONTACT_EMAIL,
  TALLY_REGISTRATION_URL,
  isStaticHostingMode,
  parseJsonApiResponse
} from '../src/lib/hostingMode';
import { OBSIDIAN_SAMPLES, REAL_CLIENT_REVIEWS } from '../src/data/obsidianData';
import { buildClientDataBackup, restoreClientDataBackup, validateBackupBundle } from '../src/lib/dataBackup';

const ROOT_DIR = path.resolve(__dirname, '..');

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('Phase 7 Firebase Hosting & Static Launch Preparation', () => {
  it('configures .firebaserc and firebase.json for project purpose-and-glow on Spark Plan without deploying', () => {
    const firebaserc = JSON.parse(readProjectFile('.firebaserc'));
    expect(firebaserc.projects?.default).toBe('purpose-and-glow');

    const firebaseJson = JSON.parse(readProjectFile('firebase.json'));
    expect(firebaseJson.firestore?.rules).toBe('firestore.rules');
    expect(firebaseJson.hosting?.public).toBe('dist');
    expect(firebaseJson.hosting?.ignore).toContain('**/aistudio/**');
    expect(firebaseJson.hosting?.rewrites).toEqual([
      {
        source: '**',
        destination: '/index.html'
      }
    ]);

    const headerSources = (firebaseJson.hosting?.headers || []).map((h: any) => h.source);
    expect(headerSources).toContain('/assets/**');
    expect(headerSources).toContain('/index.html');
  });

  it('keeps build:hosting script and preserves PUBLIC_AI_ENABLED=false + Express backend routes', () => {
    const pkg = JSON.parse(readProjectFile('package.json'));
    expect(pkg.scripts?.['build:hosting']).toContain('VITE_STATIC_HOSTING=true');

    const envExample = readProjectFile('.env.example');
    expect(envExample).toContain('PUBLIC_AI_ENABLED=false');

    const serverSource = readProjectFile('server.ts');
    expect(serverSource).toContain("app.post('/api/contact/email'");
    expect(serverSource).toContain("app.post('/api/assessment/submit'");
  });

  it('detects static hosting mode reliably across env flags and Firebase Hosting domains', () => {
    expect(isStaticHostingMode({ viteStaticHosting: 'true', hostname: 'localhost' })).toBe(true);
    expect(isStaticHostingMode({ hostname: 'purpose-and-glow.web.app' })).toBe(true);
    expect(isStaticHostingMode({ hostname: 'purpose-and-glow.firebaseapp.com' })).toBe(true);
    expect(isStaticHostingMode({ hostname: 'localhost' })).toBe(false);
    expect(
      isStaticHostingMode({
        viteStaticHosting: 'true',
        viteBackendApiEnabled: 'true',
        hostname: 'purpose-and-glow.web.app'
      })
    ).toBe(false);
  });

  it('rejects HTTP 200 HTML SPA fallback responses instead of throwing raw JSON parse errors or faking success', async () => {
    const htmlFallback = new Response('<!doctype html><html><body>SPA</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    const parsedHtml = await parseJsonApiResponse(htmlFallback);
    expect(parsedHtml.ok).toBe(false);
    expect(parsedHtml.isHtmlFallback).toBe(true);
    expect(parsedHtml.data).toBeNull();

    const jsonOk = new Response(JSON.stringify({ success: true, id: 'inq-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    const parsedJson = await parseJsonApiResponse<{ success: boolean; id: string }>(jsonOk);
    expect(parsedJson.ok).toBe(true);
    expect(parsedJson.isHtmlFallback).toBe(false);
    expect(parsedJson.data?.id).toBe('inq-1');
  });

  it('routes static forms to authentic Tally registration URL and verified business email without calling /api on static hosts', () => {
    expect(TALLY_REGISTRATION_URL).toBe('https://tally.so/r/q5a1RY');
    expect(BUSINESS_CONTACT_EMAIL).toBe('purposeandglowcareers@gmail.com');

    const staticAwareFiles = [
      'src/components/ClientFacingSite.tsx',
      'src/components/EmailInquiryModal.tsx',
      'src/components/FreeAssessmentModal.tsx',
      'src/components/PublicResumeAssessmentModal.tsx',
      'src/components/AdminWorkbench.tsx',
      'src/components/InquiryManagementPanel.tsx',
      'src/components/AssessmentActivityPanel.tsx',
      'src/components/GeminiCopilotDrawer.tsx',
      'src/components/CadenceBoundaryPlanner.tsx'
    ];

    for (const relPath of staticAwareFiles) {
      const content = readProjectFile(relPath);
      expect(content, `${relPath} must check isStaticHostingMode`).toContain('isStaticHostingMode');
    }
  });

  it('audits all portfolio previews and confirms WordPress sample PDFs are external (not fabricated locally)', () => {
    expect(OBSIDIAN_SAMPLES).toHaveLength(9);
    for (const sample of OBSIDIAN_SAMPLES) {
      const localPreview = path.join(ROOT_DIR, 'public', sample.previewImage.replace(/^\//, ''));
      expect(fs.existsSync(localPreview), `Missing preview image ${sample.previewImage}`).toBe(true);
      expect(sample.pdfUrl.startsWith('https://purposeglowcareer.com/wp-content/uploads/')).toBe(true);
    }

    for (const review of REAL_CLIENT_REVIEWS) {
      const localImg = path.join(ROOT_DIR, 'public', review.image.replace(/^\//, ''));
      expect(fs.existsSync(localImg), `Missing review screenshot ${review.image}`).toBe(true);
    }

    expect(fs.existsSync(path.join(ROOT_DIR, 'public/assets/branding/logo-1024.png'))).toBe(true);

    // Ensure no synthetic portfolio PDFs exist locally
    const localSamplePdfs = fs
      .readdirSync(path.join(ROOT_DIR, 'public/assets/samples'))
      .filter((f) => f.toLowerCase().endsWith('.pdf'));
    expect(localSamplePdfs).toEqual([]);
  });

  it('provides accurate Privacy Policy disclosures, consent checkboxes, and minimal browser storage with Clear History', () => {
    const privacyModal = readProjectFile('src/components/PrivacyPolicyModal.tsx');
    expect(privacyModal).toContain('Tally');
    expect(privacyModal).toContain('Calendly');
    expect(privacyModal).toContain('Google Forms');
    expect(privacyModal).toContain('Firebase Hosting &amp; Authentication');
    expect(privacyModal).toContain('PUBLIC_AI_ENABLED=false');
    expect(privacyModal).toContain('Clear History');
    expect(privacyModal).toContain('BUSINESS_CONTACT_EMAIL');

    const siteCode = readProjectFile('src/components/ClientFacingSite.tsx');
    expect(siteCode).toContain('PrivacyPolicyModal');
    expect(siteCode).toContain('handleClearInquiryHistory');
    expect(siteCode).toContain('Clear History');
    expect(siteCode).toContain('fConsent');
  });

  it('preserves Admin offline JSON backup & restore cleanly for static mode (pg_client_requests + leads + rules)', async () => {
    const mem: Record<string, string> = {
      pg_lead_signals: JSON.stringify([{ id: 'lead-a', personName: 'Test Candidate' }]),
      pg_keyword_rules: JSON.stringify([{ id: 'rule-a', phrase: 'denials', weight: 15 }]),
      pg_admin_notifications: JSON.stringify([{ id: 'notif-a', senderName: 'Applicant' }]),
      pg_client_requests: JSON.stringify({
        'req-1': { id: 'req-1', first: 'Taylor', service: 'Résumé Revamp ($99)', done: false, at: 1700000000000 }
      }),
      pg_theme: 'light'
    };
    const storage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      }
    };

    const bundle = await buildClientDataBackup(storage, null);
    expect(bundle.counts.leads).toBe(1);
    expect(bundle.counts.keywordRules).toBe(1);
    expect(bundle.counts.notifications).toBe(1);
    expect(bundle.counts.clientRequests).toBe(1);

    const valid = await validateBackupBundle(bundle);
    expect(valid.valid).toBe(true);

    const freshMem: Record<string, string> = {};
    const freshStorage = {
      getItem: (k: string) => freshMem[k] ?? null,
      setItem: (k: string, v: string) => {
        freshMem[k] = v;
      }
    };

    const restored = await restoreClientDataBackup(bundle, freshStorage);
    expect(restored.restored).toBe(true);
    expect(restored.mergedCounts.leads).toBe(1);
    expect(restored.mergedCounts.clientRequests).toBe(1);
  });

  it('keeps obsidian.css layered inside @layer base/@layer components and prevents masthead/stats/hero layout overlap', () => {
    const indexCss = readProjectFile('src/index.css');
    expect(indexCss).toContain('@import "tailwindcss";');
    expect(indexCss).toContain('@custom-variant dark');
    expect(indexCss).toContain('@import "./styles/obsidian.css";');

    const obsidianCss = readProjectFile('src/styles/obsidian.css');
    expect(obsidianCss).toContain('@layer base');
    expect(obsidianCss).toContain('@layer components');
    expect(obsidianCss).toContain('overflow-x:clip');
    expect(obsidianCss).toContain('white-space:nowrap');
    // .hero must never mask horizontal child overflow with overflow:hidden
    expect(obsidianCss).not.toMatch(/\.hero\{[^}]*overflow:\s*hidden/);
    // .hero must clip both axes and isolate stacking context so .hero-accent cannot overlap #work
    expect(obsidianCss).toMatch(/\.hero\{[^}]*overflow:\s*clip/);
    expect(obsidianCss).toMatch(/\.hero\{[^}]*isolation:\s*isolate/);
    expect(obsidianCss).not.toMatch(/\.hero-accent\{[^}]*height:\s*125%/);
    expect(obsidianCss).not.toMatch(/\.hero-accent\{[^}]*top:\s*-10%/);
    expect(obsidianCss).toMatch(/\.block\{[^}]*position:\s*relative;[^}]*z-index:\s*1;[^}]*background:\s*var\(--paper\)/);
    // .hero-foot must not squeeze .stats inside a `1fr auto` grid beside .hero-cta
    expect(obsidianCss).not.toMatch(/\.hero-foot\{[^}]*1fr auto/);
    // Responsive breakpoints covering 1024px collapse, 834/768px tablet, and 430/375px phone
    expect(obsidianCss).toContain('@media (max-width:1120px)');
    expect(obsidianCss).toContain('@media (max-width:960px)');
    expect(obsidianCss).toContain('.hero-grid{grid-template-columns:minmax(0,1fr);column-gap:0');
    expect(obsidianCss).toContain('@media (max-width:768px)');
    expect(obsidianCss).toContain('@media (max-width:600px)');
    expect(obsidianCss).toContain('@media (max-width:390px)');
  });
});
