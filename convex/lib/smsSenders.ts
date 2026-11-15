// Bank SMS filtering for the SMS relay. The phone forwards every incoming SMS
// ("Any number"), so the server decides what is a bank credit.
//
// Indian transactional sender IDs follow the TRAI header format:
//   "AX-ICICIT-T"  prefix AX (operator/circle), entity ICICIT, suffix T
//   "VM-HDFCBK-S"  prefix VM, entity HDFCBK, suffix S
//   "JD-AMAZON-P"  prefix JD, entity AMAZON, suffix P (promotional)
// Older headers may have no suffix ("HDFCBK") or no prefix ("HDFCBK-T").
// Suffixes: T transactional, S service, P promotional, G government.
//
// Explicit allowlist (per store): entries are an entity ("HDFCBK"), a sender
// with a prefix or suffix ("VM-HDFCBK", "HDFCBK-T", the prefix and suffix are
// ignored when matching), or a phone number ("+919876543210"). Matching is on
// the entity. Empty list: accept only T, S or suffix-less senders whose body
// reads as a credit.
//
// Privacy: dropped SMS never store the body. Some are stored as metadata only
// (sender, suffix, reason); OTP and promotional/government SMS are not stored.

export type TraiSuffix = "T" | "S" | "P" | "G";

export interface ParsedSmsSender {
  /** Operator/circle prefix, e.g. "AX". Absent for old or non-TRAI headers. */
  prefix?: string;
  /** Sender entity, e.g. "ICICIT". Whole upper-cased sender for phone numbers and other IDs. */
  entity: string;
  suffix?: TraiSuffix;
  isPhone: boolean;
}

const TRAI_RE = /^(?:([A-Z]{2})-)?([A-Z0-9]{3,11})(?:-([TSPG]))?$/;
const PHONE_RE = /^\+?[0-9]{8,15}$/;
const OTP_RE = /\botp\b|one[\s-]?time\s+(password|passcode|code)|verification code/i;
const AMOUNT_RE = /(₹|\bRs\.?|\bINR)\s*[0-9]/i;
const CREDIT_RE = /\b(credited|received|deposited|credit)\b/i;
const DEBIT_RE = /\b(debited|debit|spent|withdrawn)\b/i;

export const MAX_SMS_SENDERS = 25;
export const MAX_DETECTED_SMS_SENDERS = 20;

/** Splits a TRAI-style sender header into prefix, entity and suffix. */
export function parseSmsSender(sender: string): ParsedSmsSender {
  const s = sender.trim().toUpperCase();
  if (PHONE_RE.test(s)) return { entity: s, isPhone: true };
  const m = s.match(TRAI_RE);
  if (m) {
    return {
      prefix: m[1] || undefined,
      entity: m[2],
      suffix: (m[3] as TraiSuffix | undefined) ?? undefined,
      isPhone: false,
    };
  }
  return { entity: s, isPhone: false };
}

/** True when the body is an OTP or verification message. Never stored. */
export function isOtpBody(body: string): boolean {
  return OTP_RE.test(body);
}

/** Amount marker plus credit wording, and no debit wording. */
export function looksLikeCredit(body: string): boolean {
  return AMOUNT_RE.test(body) && CREDIT_RE.test(body) && !DEBIT_RE.test(body);
}

/** Uppercase, trim, dedupe. Entries are kept as typed (after case folding). Null if one is malformed. */
export function normalizeSmsSenders(input: string[]): string[] | null {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const s = raw.trim().toUpperCase();
    if (!s) continue;
    if (!/^(?:[A-Z0-9]{2}-)?[A-Z0-9]{3,11}(?:-[TSPG])?$|^\+?[0-9]{8,15}$/.test(s)) return null;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** True when the sender matches an allowlist entry (entity match; phone numbers exact). */
export function smsSenderAllowed(
  sender: string,
  allowlist: string[] | undefined | null,
): boolean {
  if (!allowlist || allowlist.length === 0) return false;
  const want = parseSmsSender(sender);
  return allowlist.some((raw) => {
    const e = parseSmsSender(raw);
    if (e.isPhone || want.isPhone) return e.isPhone && want.isPhone && e.entity === want.entity;
    return e.entity === want.entity;
  });
}

export type SmsDecision =
  | { accept: true; entity: string; isPhone: boolean; suffix?: TraiSuffix }
  | {
      accept: false;
      /** false = drop silently, true = keep a metadata-only row (no body). */
      store: boolean;
      reason: string;
      suffix?: TraiSuffix;
    };

/**
 * Decides one incoming SMS. The body is only read here, never returned or stored
 * on a drop.
 */
export function decideSms(
  sender: string,
  body: string,
  allowlist: string[] | undefined | null,
): SmsDecision {
  const parsed = parseSmsSender(sender);
  const { suffix } = parsed;

  if (isOtpBody(body)) return { accept: false, store: false, reason: "otp" };
  if (suffix === "P") return { accept: false, store: false, reason: "promotional", suffix };
  if (suffix === "G") return { accept: false, store: false, reason: "government", suffix };

  const base = { entity: parsed.entity, isPhone: parsed.isPhone, suffix };
  if (allowlist && allowlist.length > 0) {
    if (smsSenderAllowed(sender, allowlist)) return { accept: true, ...base };
    return { accept: false, store: true, reason: "sender not in SMS allowlist", suffix };
  }

  if (looksLikeCredit(body)) return { accept: true, ...base };
  return { accept: false, store: true, reason: "not a credit SMS", suffix };
}
