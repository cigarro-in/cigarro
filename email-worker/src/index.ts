/**
 * Cloudflare Email Worker
 *
 * Receives forwarded bank-alert emails via Cloudflare Email Routing and
 * relays them to the Convex HTTP action `/receiveBankEmail`.
 *
 * Routing rule per org: bank-<org-slug>@yourdomain.com
 * The worker extracts `<org-slug>` from the local-part and passes it as
 * `alias` so Convex can resolve the correct organization.
 */
import PostalMime from "postal-mime";

export interface Env {
  CONVEX_URL: string; // https://<deployment>.convex.site
  EMAIL_WEBHOOK_SECRET: string;
}

async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>,
  size: number,
): Promise<Uint8Array> {
  const result = new Uint8Array(size);
  let offset = 0;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function extractAlias(to: string): string | null {
  // "bank-cigarro@yourdomain.com" → "cigarro"
  const local = to.split("@")[0] ?? "";
  if (!local.startsWith("bank-")) return null;
  const alias = local.slice("bank-".length).trim().toLowerCase();
  return alias || null;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env) {
    const alias = extractAlias(message.to);
    if (!alias) {
      console.warn("[bank-email] unrecognised To:", message.to);
      return;
    }

    const raw = await streamToArrayBuffer(message.raw, message.rawSize);
    const parsed = await PostalMime.parse(raw);

    const body = parsed.text || parsed.html || "";
    const messageId = parsed.messageId || message.headers.get("Message-ID") || "";
    if (!messageId) {
      console.warn("[bank-email] no Message-ID, dropping");
      return;
    }

    const payload = {
      alias,
      from: parsed.from?.address ?? message.from,
      subject: parsed.subject ?? "",
      rawBody: body,
      messageId,
    };

    const res = await fetch(`${env.CONVEX_URL}/receiveBankEmail`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.EMAIL_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(
        "[bank-email] Convex responded",
        res.status,
        await res.text(),
      );
      // Don't reject the message — let admin reconcile from bankEmails table
    }
  },
};
