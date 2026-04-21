import { rupeesToPaise } from "./money";

// ---------- Quoted-printable + HTML decoding ----------

function decodeQuotedPrintable(input: string): string {
  if (!input) return input;
  // Soft line breaks: `=` at end of line joins lines.
  let s = input.replace(/=\r?\n/g, "");
  // Hex escapes: `=3D` -> `=`, etc.
  s = s.replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return s;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Normalize a raw email body (HTML or quoted-printable or plain) to plain text
 * so regex templates can operate on a consistent surface.
 */
export function normalizeEmailBody(body: string): string {
  if (!body) return "";
  let s = body;
  // Decode quoted-printable first (bank emails always use this).
  if (/=[0-9A-Fa-f]{2}/.test(s) || /=\r?\n/.test(s)) {
    s = decodeQuotedPrintable(s);
  }
  // Strip <style> / <script> blocks entirely.
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  // Line-breaking tags → newline.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|tr|td|li|h[1-6])>/gi, "\n");
  // Remove remaining tags.
  s = s.replace(/<[^>]+>/g, " ");
  // Decode entities.
  s = decodeHtmlEntities(s);
  // Collapse whitespace but keep newlines as separators.
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{2,}/g, "\n");
  return s.trim();
}

// ---------- Template-based parser ----------

export interface BankEmailTemplate {
  _id?: string;
  bankKey: string;
  label: string;
  senderRegex: string;
  subjectRegex?: string;
  amountRegex: string;
  refRegex: string;
  payerVpaRegex?: string;
  payerNameRegex?: string;
  creditOnly: boolean;
  debitGuardRegex?: string;
  priority: number;
  active: boolean;
}

export interface ParsedBankEmail {
  templateId?: string;
  bankKey: string;
  amountPaise: number;
  upiRef?: string;
  payerVpa?: string;
  payerName?: string;
}

export interface ParseInput {
  from: string;
  subject?: string;
  body: string;
}

function safeRegex(src: string, flags = "i"): RegExp | null {
  try {
    return new RegExp(src, flags);
  } catch {
    return null;
  }
}

function extractFromTemplate(
  text: string,
  from: string,
  subject: string,
  t: BankEmailTemplate,
): ParsedBankEmail | null {
  const sender = safeRegex(t.senderRegex);
  if (!sender || !sender.test(from)) return null;

  if (t.subjectRegex) {
    const sub = safeRegex(t.subjectRegex);
    if (!sub || !sub.test(subject)) return null;
  }

  if (!t.creditOnly && t.debitGuardRegex) {
    const dg = safeRegex(t.debitGuardRegex);
    if (dg && dg.test(text)) return null;
  }

  const amountRe = safeRegex(t.amountRegex);
  const refRe = safeRegex(t.refRegex);
  if (!amountRe || !refRe) return null;

  const am = text.match(amountRe);
  if (!am) return null;
  const rupees = parseFloat(am[1].replace(/,/g, ""));
  if (!Number.isFinite(rupees) || rupees <= 0) return null;

  const ref = text.match(refRe);

  let payerVpa: string | undefined;
  let payerName: string | undefined;
  if (t.payerVpaRegex) {
    const re = safeRegex(t.payerVpaRegex);
    const m = re && text.match(re);
    if (m) payerVpa = m[1];
  }
  if (t.payerNameRegex) {
    const re = safeRegex(t.payerNameRegex);
    const m = re && text.match(re);
    if (m) payerName = m[1].trim().replace(/\s+/g, " ");
  }

  return {
    templateId: t._id,
    bankKey: t.bankKey,
    amountPaise: rupeesToPaise(rupees),
    upiRef: ref?.[1],
    payerVpa,
    payerName,
  };
}

/**
 * Try every template in priority order against the input. Returns the first match.
 */
export function parseWithTemplates(
  input: ParseInput,
  templates: BankEmailTemplate[],
): ParsedBankEmail | null {
  const text = normalizeEmailBody(input.body);
  const subject = input.subject ?? "";
  const sorted = templates
    .filter((t) => t.active)
    .slice()
    .sort((a, b) => a.priority - b.priority);
  for (const t of sorted) {
    const hit = extractFromTemplate(text, input.from, subject, t);
    if (hit) return hit;
  }
  return null;
}

/**
 * Legacy fallback parser — used when no templates are configured.
 * Kept for backward compatibility with the original ingestion path.
 */
const FALLBACK_AMOUNT_RE = /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
const FALLBACK_REF_RE =
  /(?:UPI(?:\s|-)?Ref(?:erence)?(?:\s|-)?(?:No\.?|Number)?|RRN|Txn(?:\s*ID)?)[^\w]{0,5}([A-Z0-9]{6,})/i;

export function parseBankEmail(body: string): ParsedBankEmail | null {
  const text = normalizeEmailBody(body);
  const am = text.match(FALLBACK_AMOUNT_RE);
  if (!am) return null;
  const rupees = parseFloat(am[1].replace(/,/g, ""));
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  const ref = text.match(FALLBACK_REF_RE);
  return {
    bankKey: "unknown",
    amountPaise: rupeesToPaise(rupees),
    upiRef: ref?.[1],
  };
}

// ---------- System template seeds ----------

/**
 * Built-in bank templates. Seeded into `bankEmailTemplates` on first admin visit
 * or via `npx convex run email:seedTemplates`.
 * These match real production emails — updates to real formats go here first.
 */
export const SYSTEM_TEMPLATES: Omit<BankEmailTemplate, "_id">[] = [
  {
    bankKey: "hdfc",
    label: "HDFC Bank UPI credit alert",
    senderRegex: "@hdfcbank\\.bank\\.in|@hdfcbank\\.net|alerts@hdfcbank",
    // HDFC subject observed: "Account update for your HDFC Bank A/c"
    // Client may prefix with "View:" so make subject optional / lenient.
    subjectRegex: "account\\s+update|upi|credited",
    amountRegex:
      "Rs\\.?\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s+is\\s+successfully\\s+credited",
    refRegex:
      "UPI\\s+transaction\\s+reference\\s+number\\s+is\\s+([0-9]{6,})",
    payerVpaRegex: "by\\s+VPA\\s+([A-Za-z0-9._\\-]+@[A-Za-z0-9.\\-]+)",
    // Name appears after the VPA, before " on <date>". All-caps or Title.
    payerNameRegex:
      "by\\s+VPA\\s+[A-Za-z0-9._\\-]+@[A-Za-z0-9.\\-]+\\s+([A-Za-z][A-Za-z .'\\-]+?)\\s+on\\s+\\d",
    creditOnly: false,
    debitGuardRegex: "\\bdebited\\b|\\bwithdrawn\\b|\\bDr\\.\\s",
    priority: 10,
    active: true,
  },
];
