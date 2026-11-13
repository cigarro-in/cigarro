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
import type * as adminProducts from "../adminProducts.js";
import type * as adminStats from "../adminStats.js";
import type * as appConfig from "../appConfig.js";
import type * as catalog from "../catalog.js";
import type * as cloudflare from "../cloudflare.js";
import type * as content from "../content.js";
import type * as crashLogs from "../crashLogs.js";
import type * as crons from "../crons.js";
import type * as discounts from "../discounts.js";
import type * as domains from "../domains.js";
import type * as email from "../email.js";
import type * as geocode from "../geocode.js";
import type * as gmail from "../gmail.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as invoices from "../invoices.js";
import type * as lib_adminStores from "../lib/adminStores.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bankAlias from "../lib/bankAlias.js";
import type * as lib_bankSenders from "../lib/bankSenders.js";
import type * as lib_citadel from "../lib/citadel.js";
import type * as lib_citadelAuth from "../lib/citadelAuth.js";
import type * as lib_cleanDescription from "../lib/cleanDescription.js";
import type * as lib_crashLog from "../lib/crashLog.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_domainStatus from "../lib/domainStatus.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_hosts from "../lib/hosts.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_imageRefs from "../lib/imageRefs.js";
import type * as lib_inventory from "../lib/inventory.js";
import type * as lib_legacyOrg from "../lib/legacyOrg.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_org from "../lib/org.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_pollSchedule from "../lib/pollSchedule.js";
import type * as lib_redirectPaths from "../lib/redirectPaths.js";
import type * as lib_siteSettings from "../lib/siteSettings.js";
import type * as lib_smokeshopRedirects from "../lib/smokeshopRedirects.js";
import type * as lib_upi from "../lib/upi.js";
import type * as marketing from "../marketing.js";
import type * as migrations from "../migrations.js";
import type * as orders from "../orders.js";
import type * as organizations from "../organizations.js";
import type * as payments from "../payments.js";
import type * as platform from "../platform.js";
import type * as redirects from "../redirects.js";
import type * as referrals from "../referrals.js";
import type * as reviews from "../reviews.js";
import type * as saHttp from "../saHttp.js";
import type * as seoHealth from "../seoHealth.js";
import type * as storeImport from "../storeImport.js";
import type * as storePages from "../storePages.js";
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
  adminProducts: typeof adminProducts;
  adminStats: typeof adminStats;
  appConfig: typeof appConfig;
  catalog: typeof catalog;
  cloudflare: typeof cloudflare;
  content: typeof content;
  crashLogs: typeof crashLogs;
  crons: typeof crons;
  discounts: typeof discounts;
  domains: typeof domains;
  email: typeof email;
  geocode: typeof geocode;
  gmail: typeof gmail;
  http: typeof http;
  inventory: typeof inventory;
  invoices: typeof invoices;
  "lib/adminStores": typeof lib_adminStores;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/bankAlias": typeof lib_bankAlias;
  "lib/bankSenders": typeof lib_bankSenders;
  "lib/citadel": typeof lib_citadel;
  "lib/citadelAuth": typeof lib_citadelAuth;
  "lib/cleanDescription": typeof lib_cleanDescription;
  "lib/crashLog": typeof lib_crashLog;
  "lib/crypto": typeof lib_crypto;
  "lib/domainStatus": typeof lib_domainStatus;
  "lib/email": typeof lib_email;
  "lib/hosts": typeof lib_hosts;
  "lib/ids": typeof lib_ids;
  "lib/imageRefs": typeof lib_imageRefs;
  "lib/inventory": typeof lib_inventory;
  "lib/legacyOrg": typeof lib_legacyOrg;
  "lib/money": typeof lib_money;
  "lib/org": typeof lib_org;
  "lib/phone": typeof lib_phone;
  "lib/pollSchedule": typeof lib_pollSchedule;
  "lib/redirectPaths": typeof lib_redirectPaths;
  "lib/siteSettings": typeof lib_siteSettings;
  "lib/smokeshopRedirects": typeof lib_smokeshopRedirects;
  "lib/upi": typeof lib_upi;
  marketing: typeof marketing;
  migrations: typeof migrations;
  orders: typeof orders;
  organizations: typeof organizations;
  payments: typeof payments;
  platform: typeof platform;
  redirects: typeof redirects;
  referrals: typeof referrals;
  reviews: typeof reviews;
  saHttp: typeof saHttp;
  seoHealth: typeof seoHealth;
  storeImport: typeof storeImport;
  storePages: typeof storePages;
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
