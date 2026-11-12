// Cloudflare Pages custom-domain API wrappers. Plain fetch, default Convex
// runtime (no "use node"). Only internal actions are exported; callers go
// through convex/domains.ts, which owns auth and DB writes.
//
// Endpoints (Pages project domains):
//   POST   /accounts/{account}/pages/projects/{project}/domains            {name}
//   GET    /accounts/{account}/pages/projects/{project}/domains/{name}
//   DELETE /accounts/{account}/pages/projects/{project}/domains/{name}
// Response envelope: { success, errors[], messages[], result }.

import { ConvexError, v } from "convex/values";
import { internalAction } from "./_generated/server";

const CF_API = "https://api.cloudflare.com/client/v4";

export type CfTxtRecord = { name: string; value: string };

export type CfDomainState = {
  // Cloudflare's domain id when present. Pages domains are keyed by name.
  id?: string;
  // Cloudflare status: initializing | pending | active | deactivated | blocked
  // | error, or "absent" (not on the project) / "deleted" (after DELETE).
  status: string;
  cnameTarget: string;
  txtRecords: CfTxtRecord[];
  error?: string;
};

export type CfConfig = { token: string; accountId: string; project: string };

export function cfConfig(): CfConfig {
  const token = process.env.CF_API_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;
  if (!token || !accountId) throw new ConvexError({ code: "CF_NOT_CONFIGURED" });
  return {
    token,
    accountId,
    project: process.env.CF_PAGES_PROJECT || "cigarro",
  };
}

type Obj = Record<string, unknown>;

function asObj(x: unknown): Obj {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {};
}

function asStr(x: unknown): string | undefined {
  return typeof x === "string" && x.trim() !== "" ? x : undefined;
}

// Pure. Turns a Pages domain object into CfDomainState. Tolerates missing
// fields: CNAME target defaults to <project>.pages.dev; TXT records are
// collected from validation_data / verification_data when present.
export function normalizePagesDomain(raw: unknown, project: string): CfDomainState {
  const r = asObj(raw);
  const validation = asObj(r.validation_data);
  const verification = asObj(r.verification_data);

  const status =
    asStr(r.status) ?? asStr(validation.status) ?? asStr(verification.status) ?? "unknown";
  const cnameTarget =
    asStr(validation.cname_target) ?? asStr(r.cname_target) ?? `${project}.pages.dev`;

  const txtRecords: CfTxtRecord[] = [];
  for (const src of [validation, verification, r]) {
    const name = asStr(src.txt_name);
    const value = asStr(src.txt_value);
    if (name && value && !txtRecords.some((t) => t.name === name && t.value === value)) {
      txtRecords.push({ name, value });
    }
  }

  const error =
    asStr(validation.error_message) ??
    asStr(verification.error_message) ??
    asStr(r.error_message);

  const id = asStr(r.id);
  return {
    ...(id ? { id } : {}),
    status,
    cnameTarget,
    txtRecords,
    ...(error ? { error } : {}),
  };
}

// Pure. Interprets one Cloudflare response. 404 maps to status "absent" only
// when allowMissing is set (GET/DELETE); otherwise it is an error.
export function normalizeCfResponse(
  httpStatus: number,
  body: unknown,
  project: string,
  opts: { allowMissing?: boolean } = {},
): CfDomainState {
  if (httpStatus === 404 && opts.allowMissing) {
    return { status: "absent", cnameTarget: `${project}.pages.dev`, txtRecords: [] };
  }
  const env = asObj(body);
  if (httpStatus < 200 || httpStatus >= 300 || env.success === false) {
    const errs = Array.isArray(env.errors) ? env.errors : [];
    const first = asObj(errs[0]);
    throw new ConvexError({
      code: "CF_API_ERROR",
      httpStatus,
      message: asStr(first.message) ?? `Cloudflare returned HTTP ${httpStatus}`,
    });
  }
  return normalizePagesDomain(env.result, project);
}

// Pure. True when a POST failed only because the domain already exists, so
// the caller should GET the existing domain instead.
export function isAlreadyExists(httpStatus: number, body: unknown): boolean {
  if (httpStatus === 409) return true;
  const env = asObj(body);
  const errs = Array.isArray(env.errors) ? env.errors : [];
  return errs.some((e) => /already exists/i.test(String(asObj(e).message ?? "")));
}

async function cfCall(
  cfg: CfConfig,
  method: "GET" | "POST" | "DELETE",
  hostname: string | null,
  body?: unknown,
): Promise<{ httpStatus: number; body: unknown }> {
  const base =
    `${CF_API}/accounts/${encodeURIComponent(cfg.accountId)}` +
    `/pages/projects/${encodeURIComponent(cfg.project)}/domains`;
  const url = hostname ? `${base}/${encodeURIComponent(hostname)}` : base;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ConvexError({ code: "CF_UNREACHABLE" });
  }
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { httpStatus: res.status, body: parsed };
}

export const addPagesDomain = internalAction({
  args: { hostname: v.string() },
  handler: async (_ctx, { hostname }): Promise<CfDomainState> => {
    const cfg = cfConfig();
    const post = await cfCall(cfg, "POST", null, { name: hostname });
    if (isAlreadyExists(post.httpStatus, post.body)) {
      const got = await cfCall(cfg, "GET", hostname);
      return normalizeCfResponse(got.httpStatus, got.body, cfg.project);
    }
    return normalizeCfResponse(post.httpStatus, post.body, cfg.project);
  },
});

export const getPagesDomain = internalAction({
  args: { hostname: v.string() },
  handler: async (_ctx, { hostname }): Promise<CfDomainState> => {
    const cfg = cfConfig();
    const res = await cfCall(cfg, "GET", hostname);
    return normalizeCfResponse(res.httpStatus, res.body, cfg.project, { allowMissing: true });
  },
});

export const deletePagesDomain = internalAction({
  args: { hostname: v.string() },
  handler: async (_ctx, { hostname }): Promise<CfDomainState> => {
    const cfg = cfConfig();
    const res = await cfCall(cfg, "DELETE", hostname);
    if (res.httpStatus === 404) {
      return { status: "absent", cnameTarget: `${cfg.project}.pages.dev`, txtRecords: [] };
    }
    normalizeCfResponse(res.httpStatus, res.body, cfg.project);
    return { status: "deleted", cnameTarget: `${cfg.project}.pages.dev`, txtRecords: [] };
  },
});
