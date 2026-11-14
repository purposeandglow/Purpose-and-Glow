import mammoth from 'mammoth';
import { redactContactPii, type PiiRedactionResult } from './piiRedactor.ts';
import { MAX_RESUME_CHARS, MIN_RESUME_CHARS } from './assessmentConstants.ts';

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export type DetectedResumeFileType = 'pdf' | 'docx' | 'doc_legacy' | 'unknown';

export interface ParsedResumeOutcome {
  ok: boolean;
  fileType?: DetectedResumeFileType;
  fileName?: string;
  rawExtractedText?: string;
  redactedText?: string;
  redactionSummary?: PiiRedactionResult['counts'];
  totalRedactions?: number;
  truncated?: boolean;
  errorCode?:
    | 'FILE_EMPTY'
    | 'FILE_TOO_LARGE'
    | 'UNSUPPORTED_TYPE'
    | 'LEGACY_DOC_UNSUPPORTED'
    | 'SCANNED_OR_EMPTY_PDF'
    | 'INSUFFICIENT_TEXT'
    | 'PARSE_FAILED';
  errorMessage?: string;
}

export function detectFileSignature(bytes: Uint8Array, fileName = '', mimeType = ''): DetectedResumeFileType {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  // %PDF-
  const isPdfMagic =
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;

  if (isPdfMagic) {
    return 'pdf';
  }

  // PK\x03\x04 (ZIP container used by DOCX)
  const isZipMagic =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (
    isZipMagic &&
    (lowerName.endsWith('.docx') ||
      lowerMime.includes('wordprocessingml') ||
      lowerMime.includes('application/zip') ||
      !lowerName)
  ) {
    return 'docx';
  }

  // D0 CF 11 E0 A1 B1 1A E1 (OLE Compound Binary - legacy .doc)
  const isOleMagic =
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1;

  if (isOleMagic || lowerName.endsWith('.doc')) {
    return 'doc_legacy';
  }

  return 'unknown';
}

export async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    } catch {
      // Fallback gracefully if bundler does not expose import.meta.url worker
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
    ...(typeof window === 'undefined' ? { disableWorker: true } : {}),
  } as any);

  const pdfDoc = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    const maxPages = Math.min(pdfDoc.numPages || 0, 12);
    for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const strings = (textContent.items || [])
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .filter(Boolean);
      pageTexts.push(strings.join(' '));
    }
  } finally {
    await (pdfDoc as any).destroy?.().catch(() => {});
  }

  return pageTexts
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromDocxBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const input: any =
    typeof window === 'undefined' && typeof Buffer !== 'undefined'
      ? { buffer: Buffer.from(arrayBuffer) }
      : { arrayBuffer };
  const result = await mammoth.extractRawText(input);
  return String(result.value || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function parseResumeBuffer(params: {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType?: string;
}): Promise<ParsedResumeOutcome> {
  const { buffer, fileName, mimeType = '' } = params;

  if (!buffer || buffer.byteLength === 0) {
    return {
      ok: false,
      fileName,
      errorCode: 'FILE_EMPTY',
      errorMessage: 'The selected file appears to be empty.',
    };
  }

  if (buffer.byteLength > MAX_RESUME_FILE_BYTES) {
    return {
      ok: false,
      fileName,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: 'File exceeds the 5 MB safety limit. Please upload a smaller PDF or DOCX file, or paste your résumé text.',
    };
  }

  const bytes = new Uint8Array(buffer);
  const detectedType = detectFileSignature(bytes, fileName, mimeType);

  if (detectedType === 'doc_legacy') {
    return {
      ok: false,
      fileType: 'doc_legacy',
      fileName,
      errorCode: 'LEGACY_DOC_UNSUPPORTED',
      errorMessage:
        'Older binary .doc files cannot be safely read in the browser. Please save as .docx or .pdf, or copy and paste your résumé text directly in the Paste Text tab.',
    };
  }

  if (detectedType === 'unknown') {
    return {
      ok: false,
      fileType: 'unknown',
      fileName,
      errorCode: 'UNSUPPORTED_TYPE',
      errorMessage:
        'Unsupported or invalid file format. Please upload a valid .pdf or .docx résumé (up to 5 MB), or paste your résumé text.',
    };
  }

  try {
    const rawExtracted =
      detectedType === 'pdf'
        ? await extractTextFromPdfBytes(bytes)
        : await extractTextFromDocxBuffer(buffer);

    if (!rawExtracted || rawExtracted.trim().length === 0) {
      return {
        ok: false,
        fileType: detectedType,
        fileName,
        errorCode: detectedType === 'pdf' ? 'SCANNED_OR_EMPTY_PDF' : 'INSUFFICIENT_TEXT',
        errorMessage:
          detectedType === 'pdf'
            ? 'No selectable text was found in this PDF (it may be a scanned image). Please paste your résumé text directly or export a text-based PDF/DOCX.'
            : 'No readable text was found inside this Word document. Please check the file or paste your résumé text directly.',
      };
    }

    if (rawExtracted.trim().length < MIN_RESUME_CHARS) {
      return {
        ok: false,
        fileType: detectedType,
        fileName,
        errorCode: 'INSUFFICIENT_TEXT',
        errorMessage: `Only ${rawExtracted.trim().length} characters were extracted. Please provide at least ${MIN_RESUME_CHARS} characters of résumé content for a meaningful assessment.`,
      };
    }

    const truncated = rawExtracted.length > MAX_RESUME_CHARS;
    const boundedRaw = rawExtracted.slice(0, MAX_RESUME_CHARS);
    const redaction = redactContactPii(boundedRaw);

    return {
      ok: true,
      fileType: detectedType,
      fileName,
      rawExtractedText: boundedRaw,
      redactedText: redaction.redactedText,
      redactionSummary: redaction.counts,
      totalRedactions: redaction.totalRedactions,
      truncated,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      fileType: detectedType,
      fileName,
      errorCode: 'PARSE_FAILED',
      errorMessage:
        err instanceof Error
          ? `Could not read this file (${err.message}). Please try saving a clean PDF/DOCX or paste your résumé text.`
          : 'Could not read this file. Please paste your résumé text instead.',
    };
  }
}

export async function parseResumeFile(file: File): Promise<ParsedResumeOutcome> {
  if (file.size > MAX_RESUME_FILE_BYTES) {
    return {
      ok: false,
      fileName: file.name,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: 'File exceeds the 5 MB safety limit. Please upload a smaller PDF or DOCX file, or paste your résumé text.',
    };
  }

  const buffer = await file.arrayBuffer();
  return parseResumeBuffer({
    buffer,
    fileName: file.name,
    mimeType: file.type,
  });
}
