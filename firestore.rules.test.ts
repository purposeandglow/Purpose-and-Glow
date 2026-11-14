import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

describe('Firestore Security Rules & Blueprint Structural Audit ("Dirty Dozen" Invariants)', () => {
  it('enforces rules_version = 2 and global default-deny catch-all', () => {
    expect(rulesText).toMatch(/rules_version\s*=\s*'2'/);
    expect(rulesText).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
  });

  it('defines a match block for every collection declared in firebase-blueprint.json', () => {
    const collectionPaths = Object.keys(blueprint.firestore || {});
    expect(collectionPaths.length).toBeGreaterThanOrEqual(6);
    for (const fullPath of collectionPaths) {
      const topCollection = fullPath.split('/').filter(Boolean)[0];
      expect(rulesText).toContain(`match /${topCollection}/`);
    }
  });

  it('requires email_verified == true and bootstrapped founder email for admin access (blocks email spoofing)', () => {
    expect(rulesText).toContain('request.auth.token.email_verified == true');
    expect(rulesText).toContain("request.auth.token.email == 'purposeandglowcareers@gmail.com'");
  });

  it('forbids client self-assignment on /admins and client writes on /inquiries create and /usageCounters', () => {
    expect(rulesText).toMatch(/match \/admins\/\{adminUid\}[\s\S]*allow list, create, update, delete:\s*if false;/);
    expect(rulesText).toMatch(/match \/inquiries\/\{inquiryId\}[\s\S]*allow create:\s*if false;/);
    expect(rulesText).toMatch(/match \/usageCounters\/\{counterId\}[\s\S]*allow list, create, update, delete:\s*if false;/);
  });

  it('never places get() or exists() inside any allow list rule (Pillar 8 cost guard)', () => {
    const listRules = rulesText.match(/allow\s+list\s*:[^;]+;/g) || [];
    expect(listRules.length).toBeGreaterThan(0);
    for (const rule of listRules) {
      expect(rule).not.toContain('get(');
      expect(rule).not.toContain('exists(');
      expect(rule).not.toContain('isAdminDocMember(');
    }
  });

  it('applies isValidId regex guard and enforces server request.time timestamps and affectedKeys()', () => {
    expect(rulesText).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
    expect(rulesText).toContain('incoming().createdAt == request.time');
    expect(rulesText).toContain('incoming().updatedAt == request.time');
    expect(rulesText).toContain('affectedKeys().hasOnly(');
    expect(rulesText).toContain('keys().hasOnly(');
  });
});
