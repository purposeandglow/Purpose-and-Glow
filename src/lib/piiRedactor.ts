export interface PiiRedactionCounts {
  emails: number;
  phones: number;
  urls: number;
  addresses: number;
}

export interface PiiRedactionResult {
  redactedText: string;
  counts: PiiRedactionCounts;
  totalRedactions: number;
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX =
  /(?:(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})(?:\s*(?:x|ext\.?)\s*\d{1,5})?/gi;
const URL_REGEX =
  /\b(?:https?:\/\/|www\.)[^\s<>()]+|\blinkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi;
const STREET_ADDRESS_REGEX =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Parkway|Pkwy|Circle|Cir|Place|Pl|Terrace|Ter)\.?(?:,?\s*(?:Apt|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?\b/gi;
const CITY_STATE_ZIP_REGEX =
  /\b[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;

/**
 * Redacts personal contact details (emails, phone numbers, personal URLs, street addresses)
 * locally in the browser or before external AI submission so real client contact PII
 * is stripped by default.
 */
export function redactContactPii(rawText: string): PiiRedactionResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      redactedText: '',
      counts: { emails: 0, phones: 0, urls: 0, addresses: 0 },
      totalRedactions: 0,
    };
  }

  let emails = 0;
  let phones = 0;
  let urls = 0;
  let addresses = 0;

  let text = rawText;

  text = text.replace(EMAIL_REGEX, () => {
    emails += 1;
    return '[REDACTED_EMAIL]';
  });

  text = text.replace(URL_REGEX, () => {
    urls += 1;
    return '[REDACTED_LINK]';
  });

  text = text.replace(PHONE_REGEX, () => {
    phones += 1;
    return '[REDACTED_PHONE]';
  });

  text = text.replace(STREET_ADDRESS_REGEX, () => {
    addresses += 1;
    return '[REDACTED_STREET_ADDRESS]';
  });

  text = text.replace(CITY_STATE_ZIP_REGEX, (match) => {
    // Keep city/state general region if helpful, mask only ZIP code
    addresses += 1;
    return match.replace(/\d{5}(?:-\d{4})?$/, '[REDACTED_ZIP]');
  });

  return {
    redactedText: text,
    counts: { emails, phones, urls, addresses },
    totalRedactions: emails + phones + urls + addresses,
  };
}
