/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminCatalog from "../adminCatalog.js";
import type * as adminStats from "../adminStats.js";
import type * as appConfig from "../appConfig.js";
import type * as catalog from "../catalog.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as discounts from "../discounts.js";
import type * as email from "../email.js";
import type * as gmail from "../gmail.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invoices from "../invoices.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_inventory from "../lib/inventory.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_upi from "../lib/upi.js";
import type * as marketing from "../marketing.js";
import type * as orders from "../orders.js";
import type * as organizations from "../organizations.js";
import type * as payments from "../payments.js";
import type * as referrals from "../referrals.js";
import type * as reviews from "../reviews.js";
import type * as userState from "../userState.js";
import type * as wallet from "../wallet.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminCatalog: typeof adminCatalog;
  adminStats: typeof adminStats;
  appConfig: typeof appConfig;
  catalog: typeof catalog;
  content: typeof content;
  crons: typeof crons;
  discounts: typeof discounts;
  email: typeof email;
  gmail: typeof gmail;
  http: typeof http;
  inventory: typeof inventory;
  invoices: typeof invoices;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/email": typeof lib_email;
  "lib/ids": typeof lib_ids;
  "lib/inventory": typeof lib_inventory;
  "lib/money": typeof lib_money;
  "lib/phone": typeof lib_phone;
  "lib/upi": typeof lib_upi;
  marketing: typeof marketing;
  orders: typeof orders;
  organizations: typeof organizations;
  payments: typeof payments;
  referrals: typeof referrals;
  reviews: typeof reviews;
  userState: typeof userState;
  wallet: typeof wallet;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
