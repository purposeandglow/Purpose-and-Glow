# Proposed Firestore Rules Update for `/inquiries` (For Review Only — NOT Deployed)

This proposal aligns `firestore.rules` with the expanded Inquiry Management workflow (`new`, `contacted`, `in_progress`, `completed`, `closed`) and notification status tracking.

**Important:** No changes were applied to `firestore.rules` and nothing was deployed. Because the Express backend currently reads and writes `/inquiries` via `firebase-admin` (Admin SDK authenticated on the server), persistent Firestore storage works securely once Firebase Admin credentials/ADC are attached without opening client SDK writes. Apply the proposed rules below only if you approve updating `firestore.rules` and `firebase-blueprint.json`.

## Proposed `isValidInquiry(data)` Helper Update

```javascript
function isValidInquiryStatus(status) {
  return status in [
    'new',
    'contacted',
    'in_progress',
    'completed',
    'closed'
  ];
}

function isValidInquiry(data) {
  return data.keys().hasAll([
      'id',
      'ownerEmail',
      'inquiryType',
      'intakeChannel',
      'senderName',
      'senderEmail',
      'service',
      'urgency',
      'message',
      'isRead',
      'status',
      'notificationStatus',
      'notificationProvider',
      'notificationAttempts',
      'createdAt',
      'updatedAt'
    ])
    && data.keys().hasOnly([
      'id',
      'ownerEmail',
      'inquiryType',
      'intakeChannel',
      'senderName',
      'senderEmail',
      'senderEmailNormalized',
      'senderPhone',
      'service',
      'currentRole',
      'targetRole',
      'locationState',
      'preferredIndustry',
      'urgency',
      'message',
      'resumeIntakeNote',
      'recipientEmail',
      'timestamp',
      'isRead',
      'status',
      'adminNotes',
      'dedupeKey',
      'notificationStatus',
      'notificationProvider',
      'notificationAttempts',
      'lastNotificationAttemptAt',
      'notificationId',
      'notificationError',
      'createdAt',
      'updatedAt'
    ])
    && isValidId(data.id)
    && data.ownerEmail is string && data.ownerEmail == 'purposeandglowcareers@gmail.com'
    && data.inquiryType in ['contact_form', 'complimentary_human_review']
    && data.intakeChannel in ['website_contact_form', 'website_human_review']
    && data.senderName is string && data.senderName.size() >= 1 && data.senderName.size() <= 120
    && data.senderEmail is string && data.senderEmail.size() >= 3 && data.senderEmail.size() <= 254
    && (!('senderPhone' in data) || (data.senderPhone is string && data.senderPhone.size() <= 40))
    && data['service'] is string && data['service'].size() >= 1 && data['service'].size() <= 160
    && data.urgency in ['urgent_48h', 'standard_week', 'flexible']
    && data.message is string && data.message.size() >= 1 && data.message.size() <= 2000
    && (!('adminNotes' in data) || (data.adminNotes is string && data.adminNotes.size() <= 1000))
    && data.isRead is bool
    && isValidInquiryStatus(data.status)
    && data.notificationStatus in ['pending', 'sent', 'failed', 'not_configured']
    && data.notificationProvider in ['resend', 'none']
    && data.notificationAttempts is int && data.notificationAttempts >= 0
    && data.createdAt is timestamp
    && data.updatedAt is timestamp;
}
```

## Proposed `match /inquiries/{inquiryId}` Block

```javascript
// 3. Confidential Client Inquiries (Written strictly by backend Admin SDK; read/updated only by Admin)
match /inquiries/{inquiryId} {
  allow get: if isValidId(inquiryId) && isAdminDocMember();
  allow list: if isBootstrappedAdmin() && existing().ownerEmail == request.auth.token.email;
  allow create: if false; // Public submissions must pass server-side validation, dedupe, and résumé-privacy checks
  allow update: if isAdminDocMember()
    && isValidId(inquiryId)
    && isValidInquiry(incoming())
    && (existing().status != 'closed' || isBootstrappedAdmin())
    && incoming().id == existing().id
    && incoming().ownerEmail == existing().ownerEmail
    && incoming().createdAt == existing().createdAt
    && incoming().updatedAt == request.time
    && incoming().diff(existing()).affectedKeys().hasOnly([
      'isRead',
      'status',
      'adminNotes',
      'updatedAt'
    ]);
  allow delete: if isValidId(inquiryId) && isAdminDocMember();
}
```
