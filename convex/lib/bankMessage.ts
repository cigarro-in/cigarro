// Pure helpers shared by the bank email and SMS paths: amount and UPI reference
// extraction, the decision config (set by the super admin, see convex/pipeline.ts)
// and setup-error detection for the phone relay.

import { rupeesToPaise } from "./money";

// ---------- Decision config ----------

/** Accepted TRAI suffix letters plus "none" for headers without a suffix. */
export type SuffixRule = "T" | "S" | "P" | "G" | "none";
export const ALL_SUFFIX_RULES: SuffixRule[] = ["T", "S", "none", "P", "G"];

export interface PipelineConfig {
  acceptedSuffixes: SuffixRule[];
  /** Known bank sender entities (e.g. "HDFCBK"). */
  bankSenders: string[];
  /** true = only known bank entities are accepted; false = any credit-looking SMS from a header. */
  knownSendersOnly: boolean;
  /** SMS from a plain phone number. Off by default: anyone can text the merchant a fake credit. */
  allowPhoneSenders: boolean;
  creditKeywords: string[];
  debitKeywords: string[];
  /** Cross-channel duplicate window (same amount, no conflicting UPI ref). */
  dedupeWindowMs: number;
}

/** Major Indian bank SMS sender entities. Super admin can edit the list. */
export const DEFAULT_BANK_SENDERS: string[] = [
  "HDFCBK", "HDFCBN", "ICICIB", "ICICIT", "SBIINB", "SBIUPI", "SBIPSG", "CBSSBI", "ATMSBI",
  "AXISBK", "AXISBN", "KOTAKB", "KOTAKM", "PNBSMS", "PNBBNK", "BOIIND", "CANBNK", "UNIONB",
  "IDFCFB", "INDUSB", "YESBNK", "FEDBNK", "BOBTXN", "BOBSMS", "IOBCHN", "IOBBNK", "CENTBK",
  "UCOBNK", "AUBANK", "RBLBNK", "IDBIBK", "PAYTMB", "AIRBNK", "JIOPBS", "KVBANK", "SIBSMS",
  "DBSBNK", "SCBANK", "HSBCIN", "CITIBK", "EQUTAS", "UJJIVN", "IPBMSG", "INDBNK", "MAHABK",
  "PSBANK", "JKBANK", "KARBNK", "CUBANK", "TMBANK", "DCBBNK", "BANDHN", "ESFBNK", "FINOBK",
];

export const DEFAULT_CREDIT_KEYWORDS = ["credited", "received", "deposited", "credit"];
export const DEFAULT_DEBIT_KEYWORDS = ["debited", "debit", "spent", "withdrawn", "sent", "paid to"];

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  acceptedSuffixes: ["T", "S", "none"],
  bankSenders: DEFAULT_BANK_SENDERS,
  knownSendersOnly: false,
  allowPhoneSenders: false,
  creditKeywords: DEFAULT_CREDIT_KEYWORDS,
  debitKeywords: DEFAULT_DEBIT_KEYWORDS,
  dedupeWindowMs: 10 * 60 * 1000,
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive regex for a keyword list. Null when the list is empty. */
export function keywordRegex(words: string[]): RegExp | null {
  const parts = words
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => escapeRe(w).replace(/\s+/g, "\\s+"));
  if (parts.length === 0) return null;
  return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
}

const AMOUNT_MARKER_RE = /(₹|\bRs\.?|\bINR)\s*[0-9]/i;

export type CreditVerdict = "credit" | "debit" | "not_credit";

/** Credit wording plus an amount marker, and no debit wording. */
export function classifyCredit(body: string, cfg: Pick<PipelineConfig, "creditKeywords" | "debitKeywords">): CreditVerdict {
  const debit = keywordRegex(cfg.debitKeywords);
  if (debit && debit.test(body)) return "debit";
  const credit = keywordRegex(cfg.creditKeywords);
  if (credit && credit.test(body) && AMOUNT_MARKER_RE.test(body)) return "credit";
  return "not_credit";
}

// ---------- Extraction ----------

const AMOUNT_RE = /(?:₹|\bRs\.?|\bINR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

/** First rupee amount in the text, in paise. */
export function extractAmountPaise(text: string): number | null {
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const rupees = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  return rupeesToPaise(rupees);
}

// UPI references (RRN) are 12 digits. Labelled forms first, then a bare
// 12-digit run next to "UPI" anywhere in the text.
const UPI_REF_PATTERNS: RegExp[] = [
  /\bUPI\s*[:/-]\s*(\d{12})(?!\d)/i,
  /\bUPI\s*(?:transaction\s+)?(?:Ref(?:erence)?|RRN|txn)\.?\s*(?:No\.?|Number|ID)?\s*(?:is)?\s*[:.\-#]?\s*(\d{12})(?!\d)/i,
  /\b(?:RRN|UTR|Ref(?:erence)?\s*(?:No\.?|Number|ID)?|Txn\s*(?:ID|No\.?))\s*(?:is)?\s*[:.\-#]?\s*(\d{12})(?!\d)/i,
];

/** 12-digit UPI reference (e.g. "UPI:668516223148" -> "668516223148"). */
export function extractUpiRef(text: string): string | undefined {
  for (const re of UPI_REF_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1];
  }
  if (/\bUPI\b/i.test(text)) {
    const bare = text.match(/(?<!\d)(\d{12})(?!\d)/);
    if (bare) return bare[1];
  }
  return undefined;
}

// ---------- Relay setup errors ----------

// MacroDroid magic text ({sms_number}), our own doc placeholders (<SENDER>) or
// Shortcuts variable names that were typed instead of inserted.
const PLACEHOLDER_RE = /\{\s*sms_[a-z_]+\s*\}|\[\s*sms_[a-z_]+\s*\]|<\s*(sender|message|body)\s*>|\{\{\s*(sender|body|message)\s*\}\}/i;

/** A plain-language reason when the phone sent template text instead of a real SMS. */
export function detectSetupError(sender: string, body: string): string | null {
  if (PLACEHOLDER_RE.test(sender) || PLACEHOLDER_RE.test(body)) {
    return "Phone sent template text instead of the SMS (magic text not replaced)";
  }
  if (!sender.trim()) return "Phone sent the SMS without the sender";
  if (!body.trim()) return "Phone sent the sender without the SMS text";
  return null;
}

/** Masks digit runs that look like one-time codes. OTP texts are kept for study, never their codes. */
export function redactCodes(body: string): string {
  return body.replace(/(?<![\d.,])\d{4,8}(?![\d.,])/g, (m) => "•".repeat(m.length));
}

// ---------- Relay payload ----------

export interface RelayPayload {
  sender: string;
  body: string;
  receivedAt?: unknown;
}

function fromJson(j: unknown): RelayPayload | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const body = typeof o.body === "string" ? o.body : typeof o.message === "string" ? o.message : null;
  if (typeof o.sender !== "string" && body === null) return null;
  return { sender: typeof o.sender === "string" ? o.sender : "", body: body ?? "", receivedAt: o.receivedAt };
}

/** Escapes raw control characters (newlines, tabs) that sit inside JSON string literals. */
function escapeControlCharsInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      } else if (ch === "\n") {
        out += "\n";
        continue;
      } else if (ch === "\r") {
        out += "\r";
        continue;
      } else if (ch === "\t") {
        out += "\t";
        continue;
      } else if (ch < " ") {
        out += " ";
        continue;
      }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}

/**
 * Lenient JSON for macros installed with the old `{"sender": "{sms_number}",
 * "body": "{sms_message}"}` template: an SMS with a newline or a quote breaks
 * that JSON. Tries strict, then with control characters escaped, then a
 * tolerant regex that takes everything between `"body": "` and the last `"}`.
 */
function parseLooseJson(text: string): RelayPayload | null {
  try {
    return fromJson(JSON.parse(text));
  } catch {
    // fall through
  }
  try {
    return fromJson(JSON.parse(escapeControlCharsInStrings(text)));
  } catch {
    // fall through
  }
  const m = text.match(/"sender"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:body|message)"\s*:\s*"([\s\S]*)"\s*(?:,\s*"receivedAt"\s*:\s*"?[^"]*"?\s*)?\}\s*$/);
  if (m) {
    const unescape = (s: string) => s.replace(/\n/g, "\n").replace(/\r/g, "").replace(/\t/g, "\t").replace(/\\"/g, '"').replace(/\\/g, "\\");
    return { sender: unescape(m[1]), body: unescape(m[2]) };
  }
  return null;
}

/**
 * Reads a relay request body. text/plain (the generated macro): first line =
 * sender, the rest = SMS. JSON (Shortcuts, older macros): parsed leniently.
 * Null when nothing usable could be read.
 */
export function parseRelayPayload(raw: string, contentType: string): RelayPayload | null {
  const trimmed = raw.replace(/^﻿/, "").trim();
  if (!trimmed) return null;
  if (contentType.includes("json") || trimmed.startsWith("{")) {
    const j = parseLooseJson(trimmed);
    if (j) return j;
    if (contentType.includes("json") || /^\{\s*"/.test(trimmed)) return null;
  }
  const nl = trimmed.search(/\r?\n/);
  if (nl < 0) return { sender: trimmed, body: "" };
  return { sender: trimmed.slice(0, nl), body: trimmed.slice(nl).replace(/^\r?\n/, "") };
}
