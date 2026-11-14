# Firestore Security Specification — Purpose & Glow Career Solutions

## 1. Data Invariants

1. **Zero Public Client PII Exposure**: No unauthenticated visitor or non-admin authenticated Google user may `get`, `list`, `create`, `update`, or `delete` documents in `inquiries`, `leads`, `copilotChats`, `keywordRules`, `admins`, or `usageCounters`.
2. **Verified Bootstrapped Admin Only**: Administrative access requires `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.token.email == 'purposeandglowcareers@gmail.com'`.
3. **No Self-Assigned Roles**: Clients cannot create, update, or delete `/admins/{adminUid}` documents.
4. **Immutable Ownership & Timestamps**: `ownerUid`, `ownerEmail`, and `createdAt` cannot change after creation; `createdAt` and `updatedAt` must match `request.time`.
5. **Terminal State Protection**: Once an inquiry reaches `status == 'responded'` or a lead reaches `status == 'archived'`, updates are blocked unless explicitly modified by the verified admin on allowlisted fields (`affectedKeys().hasOnly(...)`).
6. **Strict Schema & Size Guards**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string/number field has explicit type and upper size bounds to prevent resource poisoning.
7. **Server-Managed Usage Counters**: `/usageCounters/{counterId}` denies all client SDK writes (`allow write: if false`).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)

1. **Unauthenticated Lead List**: `GET /leads` without auth -> `PERMISSION_DENIED`.
2. **Unauthenticated Inquiry Read**: `GET /inquiries/inq-1` without auth -> `PERMISSION_DENIED`.
3. **Unauthenticated Direct Inquiry Injection**: `CREATE /inquiries/inq-spam` from client SDK without auth -> `PERMISSION_DENIED` (public inquiries go through rate-limited backend).
4. **Unverified Admin Email Spoof**: Signed-in user with `email == 'purposeandglowcareers@gmail.com'` and `email_verified == false` attempting `GET /leads` -> `PERMISSION_DENIED`.
5. **Non-Admin Authenticated User Read**: Verified Google user `attacker@gmail.com` attempting `LIST /inquiries` or `GET /copilotChats/msg-1` -> `PERMISSION_DENIED`.
6. **Privilege Escalation (Self-Admin Write)**: Authenticated user attempting `CREATE /admins/{uid}` with `{ role: 'admin' }` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection on Lead Create**: Verified admin attempting `CREATE /leads/lead-1` with extra ghost field `isSuperUser: true` -> `PERMISSION_DENIED` (`keys().hasOnly(...)` blocks it).
8. **Identity Spoofing on Lead Create**: Verified admin attempting `CREATE /leads/lead-1` with `ownerUid: 'other-uid'` != `request.auth.uid` -> `PERMISSION_DENIED`.
9. **Oversized String Poisoning**: Verified admin attempting `CREATE /leads/lead-1` with `rawText` > 12,000 chars or 1.5KB junk `leadId` -> `PERMISSION_DENIED`.
10. **Forged Timestamp Injection**: Verified admin attempting `CREATE /leads/lead-1` with backdated `createdAt` != `request.time` -> `PERMISSION_DENIED`.
11. **Immutable Field Tampering on Update**: Verified admin attempting `UPDATE /leads/lead-1` modifying `createdAt` or `ownerUid` -> `PERMISSION_DENIED`.
12. **Client Counter Bypass**: Any user or admin attempting `WRITE /usageCounters/daily_2026_11_13` via client SDK -> `PERMISSION_DENIED`.
