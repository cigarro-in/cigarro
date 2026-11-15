"use node";

// Web Push delivery (web-push, Node runtime). Only actions live here: queries and
// mutations for subscriptions are in convex/push.ts. Failures never throw into
// the payment path; expired subscriptions (404/410) are deleted.

import { ConvexError, v } from "convex/values";
import * as webpush from "web-push";
import { action, internalAction, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { PushPayload, PushTarget, vapidConfigured } from "./push";

const TTL_SECONDS = 60 * 60;

async function deliver(
  ctx: ActionCtx,
  targets: PushTarget[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number; statusCode: number | null }> {
  const result = { sent: 0, failed: 0, removed: 0, statusCode: null as number | null };
  if (targets.length === 0) return result;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  const gone: Id<"pushSubscriptions">[] = [];
  const body = JSON.stringify(payload);
  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: target.keys },
          body,
          { TTL: TTL_SECONDS, urgency: "normal" },
        );
        result.sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (result.statusCode === null && typeof statusCode === "number") result.statusCode = statusCode;
        // 404/410: the push service no longer knows this subscription. 403/400 usually
        // means the VAPID keys do not match the subscription (logged so causes can be told apart).
        console.error("web push failed", statusCode ?? "unknown", (error as Error)?.message);
        if (statusCode === 404 || statusCode === 410) {
          gone.push(target._id);
        } else {
          result.failed += 1;
        }
      }
    }),
  );
  if (gone.length > 0) {
    await ctx.runMutation(internal.push.removeSubscriptions, { ids: gone });
    result.removed = gone.length;
  }
  return result;
}

/** Sends "New order" to every admin device of the order's store. Never throws. */
export const sendOrderPaid = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    if (!vapidConfigured()) return;
    try {
      const data = await ctx.runQuery(internal.push.loadOrderPush, { orderId });
      if (!data) return;
      await deliver(ctx, data.targets, data.payload);
    } catch (error) {
      console.error("order push failed", (error as Error)?.message);
    }
  },
});

/** Test notification to one of the caller's own subscribed devices. */
export const sendTest = action({
  args: { orgId: v.id("organizations"), endpoint: v.string() },
  handler: async (ctx, { orgId, endpoint }) => {
    const data = await ctx.runQuery(api.push.testTarget, { orgId, endpoint });
    const result = await deliver(ctx, data.targets, data.payload);
    if (result.sent === 0) {
      console.error("push test failed", { statusCode: result.statusCode, removed: result.removed });
      throw new ConvexError({
        code: "PUSH_FAILED",
        removed: result.removed,
        statusCode: result.statusCode,
      });
    }
    return result;
  },
});
