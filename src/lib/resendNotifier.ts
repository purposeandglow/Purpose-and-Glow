import { DEFAULT_BUSINESS_EMAIL, type InboundInquiry } from './inquiryStore.ts';

export interface EmailNotificationResult {
  status: 'sent' | 'failed' | 'not_configured';
  provider: 'resend' | 'none';
  messageId?: string;
  error?: string;
  attemptedAt: string;
}

export interface InquiryEmailNotifier {
  isConfigured(): boolean;
  getMissingConfigReasons(): string[];
  sendInquiryNotification(inquiry: InboundInquiry): Promise<EmailNotificationResult>;
}

function isValidFromSender(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Reject obvious unconfigured placeholders
  if (/example\.com|yourdomain\.com|placeholder/i.test(trimmed)) return false;
  const emailPartMatch = /<([^>]+)>/.exec(trimmed);
  const candidate = emailPartMatch ? emailPartMatch[1].trim() : trimmed;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(candidate);
}

export class ResendEmailNotifier implements InquiryEmailNotifier {
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly recipientEmail: string;
  private readonly hasCustomFetch: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch) {
    this.env = env;
    this.apiKey = (env.RESEND_API_KEY || '').trim();
    this.fromEmail = (env.RESEND_FROM_EMAIL || '').trim();
    this.recipientEmail = (env.BUSINESS_EMAIL || DEFAULT_BUSINESS_EMAIL).trim() || DEFAULT_BUSINESS_EMAIL;
    this.hasCustomFetch = Boolean(fetchImpl);
    this.fetchImpl = fetchImpl || fetch;
  }

  getMissingConfigReasons(): string[] {
    const reasons: string[] = [];
    if (!this.apiKey) reasons.push('RESEND_API_KEY is not set');
    if (!isValidFromSender(this.fromEmail)) {
      reasons.push('RESEND_FROM_EMAIL must be set to a verified domain sender address');
    }
    return reasons;
  }

  isConfigured(): boolean {
    return this.getMissingConfigReasons().length === 0;
  }

  async sendInquiryNotification(inquiry: InboundInquiry): Promise<EmailNotificationResult> {
    const attemptedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        status: 'not_configured',
        provider: 'none',
        error: `${this.getMissingConfigReasons().join('; ')}. Inquiry saved in dashboard.`,
        attemptedAt,
      };
    }

    // Never send real outbound network requests during automated tests unless a mock fetchImpl was injected
    if ((this.env.VITEST === 'true' || this.env.NODE_ENV === 'test') && !this.hasCustomFetch) {
      return {
        status: 'not_configured',
        provider: 'none',
        error: 'Live email dispatch blocked in automated test runtime.',
        attemptedAt,
      };
    }

    const typeLabel =
      inquiry.inquiryType === 'complimentary_human_review'
        ? 'Complimentary Human Review Request'
        : 'Website Contact Inquiry';

    const fromHeader = this.fromEmail.includes('<')
      ? this.fromEmail
      : `Purpose & Glow Notifications <${this.fromEmail}>`;

    const textBody = [
      `Purpose & Glow Career Solutions — New ${typeLabel}`,
      `Inquiry ID: ${inquiry.id}`,
      `Submitted: ${inquiry.timestamp}`,
      `Status: ${inquiry.status}`,
      '',
      `Applicant Name: ${inquiry.name}`,
      `Applicant Email: ${inquiry.email}`,
      inquiry.phone ? `Phone: ${inquiry.phone}` : null,
      `Service: ${inquiry.service}`,
      `Urgency: ${inquiry.urgency}`,
      inquiry.currentRole ? `Current Role: ${inquiry.currentRole}` : null,
      inquiry.targetRole ? `Target Role: ${inquiry.targetRole}` : null,
      inquiry.locationState ? `Location: ${inquiry.locationState}` : null,
      '',
      'Submitted Details:',
      inquiry.message,
      '',
      inquiry.resumeIntakeNote ? `Privacy Note: ${inquiry.resumeIntakeNote}` : null,
      'Manage status and follow-up inside your Purpose & Glow Admin Workbench.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    try {
      const response = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [this.recipientEmail],
          reply_to: inquiry.email,
          subject: `[Purpose & Glow] ${typeLabel}: ${inquiry.service}`,
          text: textBody,
        }),
        signal: AbortSignal.timeout(6000),
      });

      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: { message?: string };
      };

      if (!response.ok || !data?.id) {
        const safeErr =
          data?.message || data?.error?.message || `Resend API returned HTTP ${response.status}`;
        return {
          status: 'failed',
          provider: 'resend',
          error: String(safeErr).slice(0, 280),
          attemptedAt,
        };
      }

      return {
        status: 'sent',
        provider: 'resend',
        messageId: String(data.id),
        attemptedAt,
      };
    } catch (err: unknown) {
      return {
        status: 'failed',
        provider: 'resend',
        error: (err instanceof Error ? err.message : 'Network error during email notification').slice(
          0,
          280
        ),
        attemptedAt,
      };
    }
  }
}
