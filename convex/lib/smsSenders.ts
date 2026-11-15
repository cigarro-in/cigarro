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
// The rules (accepted suffixes, known bank entities, credit/debit keywords,
// phone-number senders) come from the super-admin pipeline config
// (convex/pipeline.ts, convex/lib/bankMessage.ts). Merchants never see them.

import { classifyCredit, type PipelineConfig, type SuffixRule } from "./bankMessage";

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

export const MAX_SMS_SENDERS = 200;

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

/** True when the body is an OTP or verification message. Stored only with codes masked. */
export function isOtpBody(body: string): boolean {
  return OTP_RE.test(body);
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
  | { accept: true; entity: string; isPhone: boolean; suffix?: TraiSuffix; known: boolean }
  | {
      accept: false;
      /** Machine code: otp, phone_sender, suffix, unknown_sender, debit, not_credit. */
      code: string;
      /** Plain-language reason for the super-admin Messages view. */
      reason: string;
      suffix?: TraiSuffix;
      entity: string;
      isPhone: boolean;
    };

const SUFFIX_NAME: Record<TraiSuffix, string> = {
  T: "transactional",
  S: "service",
  P: "promotional",
  G: "government",
};

/** True when the sender's entity is in the known list (entity match; phone numbers exact). */
export function isKnownSender(sender: string, known: string[]): boolean {
  return smsSenderAllowed(sender, known);
}

/** Decides one incoming SMS against the pipeline config. */
export function decideSms(sender: string, body: string, cfg: PipelineConfig): SmsDecision {
  const parsed = parseSmsSender(sender);
  const { suffix, entity, isPhone } = parsed;
  const base = { entity, isPhone, suffix };

  if (isOtpBody(body)) return { accept: false, code: "otp", reason: "OTP message", ...base };
  if (isPhone && !cfg.allowPhoneSenders) {
    return { accept: false, code: "phone_sender", reason: "Sent from a phone number, not a bank", ...base };
  }
  if (!isPhone) {
    const rule: SuffixRule = suffix ?? "none";
    if (!cfg.acceptedSuffixes.includes(rule)) {
      return {
        accept: false,
        code: "suffix",
        reason: suffix ? `Sender suffix ${suffix} (${SUFFIX_NAME[suffix]}) not accepted` : "Sender without suffix not accepted",
        ...base,
      };
    }
  }
  const known = isKnownSender(sender, cfg.bankSenders);
  if (cfg.knownSendersOnly && !known) {
    return { accept: false, code: "unknown_sender", reason: "Sender is not a known bank", ...base };
  }
  const verdict = classifyCredit(body, cfg);
  if (verdict === "debit") return { accept: false, code: "debit", reason: "Debit or outgoing payment", ...base };
  if (verdict === "not_credit") return { accept: false, code: "not_credit", reason: "Not a credit message", ...base };
  return { accept: true, entity, isPhone, suffix, known };
}
